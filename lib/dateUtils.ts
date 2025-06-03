// lib/dateUtils.ts

// 2025年の日本の祝日と主要な取引所休日の例
// 注意: このリストは正確性を保証するものではありません。実際の運用では正確なデータを毎年更新・確認してください。
// 特に春分の日・秋分の日は年によって変動します。
export const JAPAN_HOLIDAYS_AND_EXCHANGE_CLOSURES_2025: Set<string> = new Set([
  // 2025年 日本の祝日 (内閣府発表に基づく想定。実際の該当年で要確認)
  "2025-01-01", // 元日
  "2025-01-13", // 成人の日 (1月第2月曜日)
  "2025-02-11", // 建国記念の日
  "2025-02-23", // 天皇誕生日 (日曜日)
  "2025-02-24", // 天皇誕生日 振替休日
  "2025-03-20", // 春分の日 (予測、官報公示を確認)
  "2025-04-29", // 昭和の日
  "2025-05-03", // 憲法記念日
  "2025-05-04", // みどりの日 (日曜日)
  "2025-05-05", // こどもの日
  "2025-05-06", // 振替休日 (5/4が日曜のため5/5が振替、5/5が祝日のため5/6が振替)
  "2025-07-21", // 海の日 (7月第3月曜日)
  "2025-08-11", // 山の日
  "2025-09-15", // 敬老の日 (9月第3月曜日)
  "2025-09-23", // 秋分の日 (予測、官報公示を確認)
  "2025-10-13", // スポーツの日 (10月第2月曜日)
  "2025-11-03", // 文化の日
  "2025-11-23", // 勤労感謝の日 (日曜日)
  "2025-11-24", // 勤労感謝の日 振替休日

  // 取引所休日 (上記祝日と重複するもの以外、年末年始など)
  "2025-01-02", // 年始休業
  "2025-01-03", // 年始休業
  "2025-12-31", // 年末休業 (大晦日)
  // 必要に応じて他の取引所休日を追加
]);

export function calculateBusinessDays(
  startDateStr: string,
  endDateStr: string,
  nonWorkingDaysSet: Set<string> = JAPAN_HOLIDAYS_AND_EXCHANGE_CLOSURES_2025 // デフォルトで定義済み休日セットを使用
): number | null {
  if (!startDateStr || !endDateStr) {
    return null;
  }

  try {
    // YYYY/MM/DD 形式を YYYY-MM-DD 形式に正規化
    const normalizedStartDateStr = startDateStr.replace(/\//g, '-');
    const normalizedEndDateStr = endDateStr.replace(/\//g, '-');

    const start = new Date(normalizedStartDateStr);
    const end = new Date(normalizedEndDateStr);

    // DateオブジェクトがUTCとして解釈するのを防ぐため、日付文字列から直接年月日を取得しローカル日付として再構築
    // または、日付文字列に時間とタイムゾーンオフセットを明示する
    // ここでは、入力がYYYY-MM-DDであるとし、ローカル日付として扱う前提で進める
    // new Date('2025-01-01') はローカルタイムゾーンの0時0分として解釈されることが多い

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
      console.warn("Invalid date range or format:", startDateStr, endDateStr);
      return null; 
    }

    let count = 0;
    const currentDate = new Date(start.getFullYear(), start.getMonth(), start.getDate()); // 時刻部分をリセット
    const finalEndDate = new Date(end.getFullYear(), end.getMonth(), end.getDate()); // 時刻部分をリセット

    while (currentDate <= finalEndDate) {
      const dayOfWeek = currentDate.getDay(); // 0 (Sunday) - 6 (Saturday)
      
      const yyyy = currentDate.getFullYear();
      const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
      const dd = String(currentDate.getDate()).padStart(2, '0');
      const formattedDate = `${yyyy}-${mm}-${dd}`;

      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 土日以外
        if (!nonWorkingDaysSet.has(formattedDate)) { // 指定休日以外
          count++;
        }
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return count;
  } catch (e) {
    console.error("Error calculating business days:", e);
    return null;
  }
}