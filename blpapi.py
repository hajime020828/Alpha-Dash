from flask import Flask, jsonify, request
import blpapi # Bloomberg API
import os # 環境変数アクセス用 (オプション)

# Bloombergセッションオプション
SESSION_OPTIONS = blpapi.SessionOptions()

# 環境変数からホストとポートを設定 (推奨)
# 設定されていない場合はデフォルト値を使用
# これらの環境変数は、Bloomberg APIが動作する環境や
# Bloomberg Desktop API Configuration Tool (bcan.exe) の設定に依存します。
# 通常、ローカルのBloomberg Terminalを使用する場合は 'localhost' と 8194 で問題ありません。
# サーバーサイド接続(SAPI/BPIPE)の場合は、適切なホストとポート、認証情報を設定する必要があります。
SESSION_OPTIONS.setServerHost(os.environ.get('BLPAPI_SERVER_HOST', 'localhost'))
SESSION_OPTIONS.setServerPort(int(os.environ.get('BLPAPI_SERVER_PORT', 8194)))

# SAPI/BPIPEなど、認証が必要な場合の設定例 (通常Desktop APIでは不要)
# authOptions = "uuid={uuid};ipAddress={ipAddress}" # 環境に合わせて変更
# SESSION_OPTIONS.setAuthenticationOptions(authOptions)

app = Flask(__name__)

def get_bloomberg_price(ticker_input: str) -> tuple[float | None, str | None]:
    """
    指定されたティッカーの現在価格をBloombergから取得します。
    価格と、実際に使用したBloombergティッカー、またはエラーメッセージを返します。
    """
    session = blpapi.Session(SESSION_OPTIONS)
    price = None
    bloomberg_ticker_used = None
    error_message = None

    try:
        if not session.start():
            error_message = "Failed to start Bloomberg session."
            print(error_message)
            return None, None, error_message

        if not session.openService("//blp/refdata"):
            error_message = "Failed to open //blp/refdata service."
            print(error_message)
            session.stop()
            return None, None, error_message

        service = session.getService("//blp/refdata")
        request = service.createRequest("ReferenceDataRequest")

        # --- ティッカー形式の変換ロジック ---
        # フロントエンドから渡されるticker_input (例: "7203", "MSFT") を
        #Bloombergが期待する形式 (例: "7203 JT Equity", "MSFT US Equity") に変換します。
        #git add . これはあくまで一例であり、実際の要件に応じてより堅牢な変換が必要です。
        # 市場コードやアセットクラスを付与する必要があります。
        # ここでは、入力が数字のみの場合は日本の株式 (JT Equity)と仮定し、
        # それ以外は米国の株式 (US Equity) と仮定する非常に単純な例です。
        # 実際には、より詳細な情報(市場など)をフロントエンドから受け取るか、
        # バックエンドでより高度なティッカー解決ロジックを持つ必要があります。
        
        if ticker_input.isnumeric(): # 数字のみなら日本株と仮定
            bloomberg_ticker_used = f"{ticker_input} JT EQUITY"
        elif '.' in ticker_input: # "7203.T" のような形式を仮定
            parts = ticker_input.split('.')
            code = parts[0]
            market_suffix = parts[1].upper() if len(parts) > 1 else ""
            if market_suffix == "T": # 東京市場
                 bloomberg_ticker_used = f"{code} JT EQUITY"
            # 他の市場のサフィックスもここに追加
            else: # 不明なサフィックスの場合は EQUITY のみと仮定 (要調整)
                 bloomberg_ticker_used = f"{code} EQUITY" # これは不完全な可能性が高い
        else: # アルファベットが含まれる場合は米国株と仮定 (例: MSFT)
            bloomberg_ticker_used = f"{ticker_input.upper()} US EQUITY"
        
        # より具体的な変換ルール (例):
        # if ticker_input == "7203": bloomberg_ticker_used = "7203 JT Equity"
        # elif ticker_input == "MSFT": bloomberg_ticker_used = "MSFT US Equity"
        # else:
        #     error_message = f"Cannot determine Bloomberg ticker for input: {ticker_input}"
        #     print(error_message)
        #     session.stop()
        #     return None, None, error_message

        print(f"Attempting to use Bloomberg ticker: {bloomberg_ticker_used} for input: {ticker_input}")
        # --- ティッカー形式の変換ロジックここまで ---

        request.append("securities", bloomberg_ticker_used)
        request.append("fields", "PX_LAST") # 最新価格

        # request.set("returnEids", True) # 必要に応じてEIDを返す設定

        print(f"Sending Bloomberg Request: {request}")
        session.sendRequest(request)

        request_processed = False
        while not request_processed:
            ev = session.nextEvent(5000) # タイムアウトを5秒に設定
            if ev.eventType() == blpapi.Event.TIMEOUT:
                error_message = f"Bloomberg API request timed out for {bloomberg_ticker_used}."
                print(error_message)
                break # ループを抜ける
            
            for msg in ev:
                print(f"Bloomberg Message: {msg}") # 受信メッセージをログに出力
                if msg.correlationIds()[0].value() == request.correlationId().value(): # リクエストとレスポンスの関連付け
                    if msg.hasElement("responseError"):
                        response_error = msg.getElement("responseError")
                        error_message = f"Response Error for {bloomberg_ticker_used}: {response_error.getElementAsString('message')}"
                        print(error_message)
                        request_processed = True # エラーでも処理完了
                        break

                    security_data_array = msg.getElement("securityData")
                    for i in range(security_data_array.numValues()):
                        security_data = security_data_array.getValueAsElement(i)
                        sec_name = security_data.getElementAsString("security")
                        
                        if security_data.hasElement("fieldExceptions", True) and security_data.getElement("fieldExceptions").numValues() > 0:
                            field_exceptions_array = security_data.getElement("fieldExceptions")
                            for k in range(field_exceptions_array.numValues()):
                                field_exception = field_exceptions_array.getValueAsElement(k)
                                error_info = field_exception.getElement("errorInfo")
                                error_message = f"Field Error for {sec_name} ({field_exception.getElementAsString('fieldId')}): {error_info.getElementAsString('message')}"
                                print(error_message)
                            continue # 次のsecurityDataへ

                        if security_data.hasElement("securityError"):
                            security_error = security_data.getElement("securityError")
                            error_message = f"Security Error for {sec_name}: {security_error.getElementAsString('message')}"
                            print(error_message)
                            continue # 次のsecurityDataへ

                        field_data = security_data.getElement("fieldData")
                        if field_data.hasElement("PX_LAST"):
                            if not field_data.isNullValue("PX_LAST"):
                                price = field_data.getElementAsFloat("PX_LAST")
                                print(f"Price found for {bloomberg_ticker_used}: {price}")
                            else:
                                error_message = f"PX_LAST is null for {bloomberg_ticker_used}."
                                print(error_message)
                        else:
                            error_message = f"PX_LAST field not found for {bloomberg_ticker_used}."
                            print(error_message)
                        break # 最初のセキュリティデータで価格が見つかれば（またはエラーがあれば）終了
                
                if price is not None or error_message: # 価格取得成功または何らかのエラーがあればループを抜ける準備
                    request_processed = True
                    break
            
            # RESPONSEイベントはリクエストの最後のイベント
            if ev.eventType() == blpapi.Event.RESPONSE:
                request_processed = True # すべてのメッセージを処理した

    except Exception as e:
        error_message = f"Exception while getting price for {ticker_input}: {str(e)}"
        print(error_message)
        price = None
    finally:
        if session:
            session.stop() # 必ずセッションを停止
    
    return price, bloomberg_ticker_used, error_message

@app.route('/api/current_price', methods=['GET'])
def current_price_api():
    ticker_input = request.args.get('ticker')
    if not ticker_input:
        return jsonify({"error": "Ticker parameter is required"}), 400
    
    price, bloomberg_ticker, error = get_bloomberg_price(ticker_input)

    if price is not None:
        return jsonify({"ticker": bloomberg_ticker or ticker_input, "price": price})
    else:
        error_msg_to_return = error or f"Could not retrieve price for ticker {ticker_input}"
        # エラーメッセージにティッカー情報を含める
        if bloomberg_ticker and bloomberg_ticker != ticker_input:
             error_msg_to_return += f" (used Bloomberg ticker: {bloomberg_ticker})"
        return jsonify({"error": error_msg_to_return }), 404 # 価格が見つからない場合は404

if __name__ == '__main__':
    # デバッグモードは開発時のみtrueにしてください
    # サーバーを他のマシンからアクセス可能にする場合は host='0.0.0.0' を指定
    app.run(host='0.0.0.0', port=5001, debug=False)