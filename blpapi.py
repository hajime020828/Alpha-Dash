from flask import Flask, jsonify, request
import blpapi
import os

SESSION_OPTIONS = blpapi.SessionOptions()
SESSION_OPTIONS.setServerHost(os.environ.get('BLPAPI_SERVER_HOST', 'localhost'))
SESSION_OPTIONS.setServerPort(int(os.environ.get('BLPAPI_SERVER_PORT', 8194)))

app = Flask(__name__)

def get_reference_data(tickers, fields):
    session = blpapi.Session(SESSION_OPTIONS)
    data = []
    error_message = None

    try:
        if not session.start():
            error_message = "Failed to start Bloomberg session."
            print(error_message)
            return None, error_message

        if not session.openService("//blp/refdata"):
            error_message = "Failed to open //blp/refdata service."
            print(error_message)
            session.stop()
            return None, error_message

        service = session.getService("//blp/refdata")
        request = service.createRequest("ReferenceDataRequest")

        for ticker in tickers:
            request.append("securities", ticker)
        for field in fields:
            request.append("fields", field)

        print(f"Sending request: securities={tickers}, fields={fields}")
        session.sendRequest(request)

        done = False
        while not done:
            ev = session.nextEvent(5000)
            if ev.eventType() == blpapi.Event.TIMEOUT:
                error_message = "Bloomberg API request timed out."
                print(error_message)
                break

            for msg in ev:
                print(f"Bloomberg Message: {msg}")
                if msg.hasElement("responseError"):
                    response_error = msg.getElement("responseError")
                    error_message = f"Response Error: {response_error.getElementAsString('message')}"
                    print(error_message)
                    done = True
                    break

                if msg.hasElement("securityData"):
                    security_data_array = msg.getElement("securityData")
                    for i in range(security_data_array.numValues()):
                        security_data = security_data_array.getValueAsElement(i)
                        sec_name = security_data.getElementAsString("security")
                        row = {"security": sec_name}

                        # fieldExceptions
                        if security_data.hasElement("fieldExceptions", True) and \
                           security_data.getElement("fieldExceptions").numValues() > 0:
                            field_exceptions_array = security_data.getElement("fieldExceptions")
                            for k in range(field_exceptions_array.numValues()):
                                field_exception = field_exceptions_array.getValueAsElement(k)
                                error_info = field_exception.getElement("errorInfo")
                                field_id = field_exception.getElementAsString('fieldId')
                                error_msg = error_info.getElementAsString('message')
                                row[field_id] = f"Field Error: {error_msg}"

                        # securityError
                        if security_data.hasElement("securityError"):
                            security_error = security_data.getElement("securityError")
                            error_msg = security_error.getElementAsString('message')
                            row["securityError"] = f"Security Error: {error_msg}"

                        # fieldData
                        field_data = security_data.getElement("fieldData")
                        for field in fields:
                            # 常にrowにキーが存在するようにNoneで初期化
                            row[field] = None
                            if field_data.hasElement(field):
                                try:
                                    row[field] = field_data.getElementAsFloat(field)
                                except Exception:
                                    try:
                                        row[field] = field_data.getElementAsString(field)
                                    except Exception:
                                        pass # Noneのまま
                        data.append(row)
                done = ev.eventType() == blpapi.Event.RESPONSE

    except Exception as e:
        error_message = f"Exception while getting data: {str(e)}"
        print(error_message)
    finally:
        if session:
            session.stop()

    return data, error_message

@app.route('/api/reference_data', methods=['GET'])
def reference_data_api():
    """
    例:
    /api/reference_data?ticker=7203.T,MSFT&fields=PX_LAST,ALL_DAY_VWAP
    """
    tickers_param = request.args.get('ticker')
    # ▼▼▼ 変更箇所 ▼▼▼
    # fieldsパラメータのデフォルト値を 'PX_LAST' から 'PX_LAST,ALL_DAY_VWAP' に変更
    fields_param = request.args.get('fields', 'PX_LAST,ALL_DAY_VWAP') 
    # ▲▲▲ 変更箇所 ▲▲▲

    if not tickers_param:
        return jsonify({"error": "ticker parameter is required"}), 400

    # 複数カンマ区切り対応
    tickers = []
    for t in tickers_param.split(','):
        t = t.strip()
        # ティッカー形式変換 (より堅牢に)
        if t.isnumeric():
            tickers.append(f"{t} JT EQUITY")
        elif '.' in t:
            parts = t.split('.')
            code = parts[0]
            market_suffix = parts[1].upper() if len(parts) > 1 else ""
            if market_suffix in ("T", "JT"):
                tickers.append(f"{code} JT EQUITY")
            else:
                tickers.append(f"{code} {market_suffix} EQUITY")
        else:
            # デフォルトは米国株として扱う
            tickers.append(f"{t.upper()} US EQUITY")
            
    fields = [f.strip() for f in fields_param.split(',') if f.strip()]

    results, error = get_reference_data(tickers, fields)

    if results:
        return jsonify(results)
    else:
        error_msg_to_return = error or f"Could not retrieve reference data for ticker(s) {tickers_param}"
        return jsonify({"error": error_msg_to_return}), 500

if __name__ == '__main__':
    # Flaskのデフォルトは'127.0.0.1'なので、外部からアクセスできるように'0.0.0.0'を指定
    app.run(host='0.0.0.0', port=5001, debug=False)