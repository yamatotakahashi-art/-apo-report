// 営業報告ツールの解析・メール生成エンジン（既存 public/legacy/index.html から忠実に移植）。
// 重要: 顧客データはこのモジュール内＝ブラウザ内でのみ処理する。サーバ・外部に送らない。
// UI から切り離した純粋関数として実装（DOM 参照なし）。挙動は既存版と同一を意図。

export type MailType = "meeting" | "doc";
export type Status = "visit" | "online" | "internal" | "followup" | "other";
export type Kind = "report" | "mail";

export const STATUS_ORDER: Status[] = ["visit", "online", "internal", "followup", "other"];
export const STATUS_LABEL: Record<Status, string> = {
  visit: "訪問希望",
  online: "オンライン希望",
  internal: "社内展開希望",
  followup: "フォロー確約",
  other: "その他",
};
export const MAILTYPE_LABEL: Record<MailType, string> = { meeting: "面談案内", doc: "資料送付" };

// outcome（アポ獲得 / 資料請求）→ メール種別・doc優先の対応
export type Outcome = "appointment" | "material";
export function outcomeToMailType(o: Outcome): MailType {
  return o === "material" ? "doc" : "meeting";
}
export function outcomeWantsDoc(o: Outcome): boolean {
  return o === "material";
}

export const TODO = "【要入力】";

// ===== 正規表現（既存版からそのまま） =====
const RE = {
  phone: /^[\s]*\(?0\d{1,4}\)?[-(\s.]?\d{1,4}[-)\s.]?\d{3,4}[\s]*$/,
  phoneLoose: /(\(?0\d{1,4}\)?[-(\s.]?\d{1,4}[-)\s.]?\d{3,4})/,
  mail: /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/,
  mailLoose: /([A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,})/,
  sama: /[一-龥ァ-ヴーぁ-ん々][一-龥ァ-ヴーぁ-ん々A-Za-z\s　]{0,15}(?:様|さん)\s*$/,
  samaAnywhere: /([一-龥ァ-ヴーぁ-ん々][一-龥ァ-ヴーぁ-ん々A-Za-z\s　]{0,15})(様|さん)/,
  personSuffix:
    /(様|さん|氏|殿|部長|課長|社長|専務|常務|取締役|主任|店長|支配人|総支配人|マネージャー|室長|本部長|事業部長|執行役員|代表|施設長|ホーム長|園長|理事長|事務長|チーフ|係長|主幹|担当者)/,
  facility:
    /(株式会社|有限会社|合同会社|社会福祉法人|医療法人|学校法人|一般財団法人|公益財団法人|NPO法人|\(株\)|（株）|ホテル|旅館|リゾート|観光|ツーリスト|トラベル|温泉|ゴルフ|有料老人ホーム|老人ホーム|サ高住|グループホーム|デイサービス|介護施設|施設|HD|ホールディングス|グループ|商事|不動産|電鉄|鉄道|エアライン|空港|販売|建設|工業|製作所|製造|食品|物産|サービス|機構|協会|学園|大学|病院|医院|クリニック|会館|館|荘|苑|寮|寺|院)/,
  address:
    /(北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県|.+市.+区|.+市[一-龥ぁ-んァ-ヴ]|.+町[一-龥]|.+郡)/,
  apoResult: /(アポ|アポイント|獲得|成功|決定|確定|取得|取れ|商談化|面談OK|オンラインOK|^OK$)/i,
  docResult: /(資料請求|資料送付|資料希望|資料着地|資料郵送|資料メール|パンフ|カタログ|資料)/,
};

const HEADER_ALIASES: Record<string, string[]> = {
  priority: ["優先度", "プライオリティ"],
  no: ["no.", "no", "番号", "#", "整理番号"],
  corporation: ["法人名", "会社名", "本部", "法人", "企業名", "運営法人", "運営会社"],
  facility: ["施設名", "事業所名", "店舗名", "物件名", "拠点名", "ホーム名", "施設"],
  address: ["住所", "所在地", "所在"],
  rep: ["代表者名", "代表者", "院長名", "代表"],
  dept_unit: ["事業部", "部署", "部門", "所属", "課", "部"],
  dept: ["診療科目", "診療科", "科目", "業種"],
  site: ["サイトurl", "サイト", "url", "ホームページ", "hp", "ｕｒｌ", "webサイト"],
  phone: ["電話番号", "電話", "tel", "ｔｅｌ", "telephone", "連絡先", "電話番号1", "電話番号2", "代表電話"],
  person: ["担当", "担当者", "担当者名", "ご担当", "ご担当者", "ご担当者名", "お客様名", "責任者", "窓口", "面談相手"],
  mail: ["メール", "メールアドレス", "mail", "e-mail", "email", "mailaddress", "メアド"],
  call_date: ["架電日", "架電日時", "コール日", "tel日", "電話日", "日付"],
  call_time: ["架電時間", "コール時間", "tel時間", "時間", "時刻"],
  call_result: ["結果", "アプローチ結果", "コール結果", "tel結果", "対応結果", "ステータス", "アポ結果"],
  call_comment: ["コメント", "メモ", "備考", "詳細", "内容", "ヒアリング", "所感"],
};

// ===== 文字種・判定ヘルパ =====
export function zen2han(s: string): string {
  return (s || "").replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}
function normHeader(h: string): string {
  return (h || "").toLowerCase().replace(/[\s　・／/_（）()]/g, "").replace(/[0-9０-９]+$/, "").trim();
}
function classifyHeader(cell: string): string | null {
  const n = normHeader(cell);
  if (!n) return null;
  let best: string | null = null,
    bl = 0;
  for (const k in HEADER_ALIASES) {
    for (const a of HEADER_ALIASES[k]) {
      if (n.includes(a) && a.length > bl) {
        best = k;
        bl = a.length;
      }
    }
  }
  return best;
}
function detectHeader(line: string): boolean {
  const c = line.split("\t");
  let h = 0;
  for (const x of c) {
    if (classifyHeader(x)) h++;
  }
  return h >= 2;
}
function normalizePhone(raw: string): string {
  if (!raw) return "";
  const m = raw.match(RE.phoneLoose);
  if (!m) return raw.trim();
  return m[1].replace(/[()\s.]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function normalizeMail(raw: string): string {
  if (!raw) return "";
  const m = raw.match(RE.mailLoose);
  return m ? m[1] : raw.trim();
}
function normalizePerson(raw: string): string {
  if (!raw) return "";
  let s = raw.trim();
  s = s.replace(/^[^：:]{1,8}[：:]\s*/, "");
  s = s.replace(/[　]+/g, " ");
  return s;
}
function extractSamaName(cell: string): string {
  const t = (cell || "").trim();
  if (!t) return "";
  if (t.length <= 25 && RE.sama.test(t)) return normalizePerson(t);
  const m = t.match(RE.samaAnywhere);
  if (m) return normalizePerson((m[1] + m[2]).trim());
  return "";
}

function isDateCell(s: string): boolean {
  const t = zen2han((s || "").trim());
  if (!t) return false;
  if (/^\d{4}[\/\-年]\s?\d{1,2}[\/\-月]\s?\d{1,2}日?$/.test(t)) return true;
  if (/^\d{1,2}[\/\-月]\s?\d{1,2}日?(?:\s?\([日月火水木金土]\))?$/.test(t)) return true;
  return false;
}
function isTimeCell(s: string): boolean {
  const t = zen2han((s || "").trim());
  if (!t) return false;
  return /^\d{1,2}[:時](\d{1,2})?(:\d{1,2})?分?半?$/.test(t);
}
function isPhoneCell(s: string): boolean {
  const t = zen2han((s || "").trim());
  if (!t) return false;
  const d = t.replace(/[^\d]/g, "");
  if (d.length < 10 || d.length > 11) return false;
  return RE.phoneLoose.test(t);
}
function isPriorityCell(s: string): boolean {
  return /^(最優先|優先|通常|低|高|中|S|A|B|C)$/.test((s || "").trim());
}
function detectMeetingType(text: string, fb: string | null): string | null {
  if (!text) return fb;
  if (/オンライン|ＷＥＢ|web|zoom|teams|google\s*meet|meet\b/i.test(text)) return "オンライン";
  if (/日程調整中|調整中|候補日|どちらか|いずれか/.test(text)) return "日程調整中";
  if (/訪問希望|来訪希望|来社希望|希望/.test(text)) return "訪問希望";
  if (/確定|決定|お時間|アポ獲得/.test(text)) return "日程確定";
  return fb;
}
// コメントから相手ステータス（visit/online/internal/followup/other）を推定
export function detectStatusFromText(text: string): Status | "" {
  if (!text) return "";
  const t = text;
  if (/社内(で)?(共有|展開|検討|確認|相談|回覧)|上長|上司|決裁|稟議|持ち帰(り|って)|社内に(かけ|諮)/.test(t)) return "internal";
  if (/オンライン|ｵﾝﾗｲﾝ|ＷＥＢ|web会議|web面談|zoom|teams|google\s*meet|\bmeet\b|リモート|オンラインで/i.test(t)) return "online";
  if (/訪問|来社|来訪|対面|直接(伺|お伺)|お伺いし|ご来社/.test(t)) return "visit";
  if (/再(架電|電話|連絡|コール)|折り返し|後日(再|お)?(連絡|電話|架電)|改めて(お)?電話|コールバック|また(お)?電話|◯日に(電話|連絡)|に(再度)?(お)?電話/.test(t))
    return "followup";
  return "";
}
function extractDateTime(text: string): { date: string; time: string; idx: number }[] {
  if (!text) return [];
  const dateRe = /(\d{4})[\/\-年]\s?(\d{1,2})[\/\-月]\s?(\d{1,2})日?|(\d{1,2})[\/\-月]\s?(\d{1,2})日?/g;
  const timeRe = /(?:午前|午後|AM|PM|A\.M\.|P\.M\.)?\s?(\d{1,2})[:時]\s?(\d{0,2})\s?(?:分)?(半)?/g;
  const dates: { date: string; idx: number; len: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = dateRe.exec(text)) !== null) {
    dates.push({ date: m[1] ? `${m[1]}/${m[2]}/${m[3]}` : `${m[4]}/${m[5]}`, idx: m.index, len: m[0].length });
  }
  const times: { time: string; idx: number; len: number }[] = [];
  while ((m = timeRe.exec(text)) !== null) {
    const hh = m[1];
    let mm = m[2] || "";
    if (m[3]) mm = "30";
    const ts = mm ? `${hh}:${mm.length === 1 ? "0" + mm : mm}` : `${hh}時`;
    times.push({ time: ts, idx: m.index, len: m[0].length });
  }
  const out: { date: string; time: string; idx: number }[] = [];
  dates.forEach((d, i) => {
    const nd = i + 1 < dates.length ? dates[i + 1].idx : text.length;
    const ss = d.idx + d.len;
    const tc = times.find((t) => t.idx >= ss && t.idx + t.len <= nd);
    out.push({ date: d.date, time: tc ? tc.time : "", idx: d.idx });
  });
  return out;
}

// ===== レコード =====
export interface ParsedRecord {
  schedule: string;
  facility: string;
  address: string;
  person: string;
  phone: string;
  mail: string;
  note: string;
  dept: string;
  status: Status | "";
  statusAuto: boolean;
  warnings: string[];
  /** 個別メッセージ（任意。会社のClaude等で整えた文面を後から差し込む用） */
  aiMsg?: string;
}

interface Fields {
  priority: string;
  no: string;
  corporation: string;
  facility: string;
  address: string;
  phone: string;
  person: string;
  mail: string;
  rep: string;
  dept_unit: string;
}
interface CallRound {
  date?: string;
  time?: string;
  result?: string;
  comment?: string;
}

function parseTSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    inQ = false,
    cs = true;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQ = false;
        }
      } else cell += c;
    } else {
      if (c === '"' && cs) {
        inQ = true;
        cs = false;
      } else if (c === "\t") {
        row.push(cell);
        cell = "";
        cs = true;
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = "";
        cs = true;
      } else {
        cell += c;
        cs = false;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => (c || "").trim() !== ""));
}

function emptyFields(): Fields {
  return { priority: "", no: "", corporation: "", facility: "", address: "", phone: "", person: "", mail: "", rep: "", dept_unit: "" };
}

function parseRowWithHeader(line: string, headerMap: (string | null)[], kind: Kind): ParsedRecord {
  const cells = line.split("\t").map((s) => s.trim());
  const fields = emptyFields();
  const callRounds: CallRound[] = [];
  let cur: CallRound | null = null;
  cells.forEach((cell, i) => {
    const type = headerMap[i];
    if (!type) return;
    if (type === "call_date") {
      if (cur) callRounds.push(cur);
      cur = cell ? { date: cell } : {};
    } else if (type === "call_time") {
      if (!cur) cur = {};
      if (cell) cur.time = cell;
    } else if (type === "call_result") {
      if (!cur) cur = {};
      if (cell) cur.result = cell;
    } else if (type === "call_comment") {
      if (!cur) cur = {};
      if (cell) cur.comment = cell;
    } else if (type === "phone") {
      if (cell && !fields.phone) fields.phone = normalizePhone(cell);
    } else if (type === "mail") {
      if (cell && !fields.mail) fields.mail = normalizeMail(cell);
    } else if (type === "rep") {
      if (cell && !fields.rep) fields.rep = normalizePerson(cell);
    } else if (type === "dept_unit") {
      if (cell && !fields.dept_unit) fields.dept_unit = cell.trim();
    } else if (type === "person") {
      if (cell) {
        const sn = extractSamaName(cell);
        if (sn && !fields.rep) fields.rep = sn;
        else if (!fields.rep && kind === "mail" && !RE.facility.test(cell) && cell.length <= 20) fields.rep = normalizePerson(cell);
      }
    } else if (type === "dept" || type === "site") {
      /* 報告には出さない：診療科目/サイトURL */
    } else if ((fields as any)[type] !== undefined && cell && !(fields as any)[type]) {
      (fields as any)[type] = cell;
    }
  });
  if (cur && Object.keys(cur).length) callRounds.push(cur);
  if (!fields.phone) {
    for (const c of cells) {
      if (RE.phone.test(c)) {
        fields.phone = normalizePhone(c);
        break;
      }
    }
  }
  return finalizeRecord(fields, callRounds.filter((c) => c.date || c.result || c.comment || c.time), { wantDoc: kind === "mail" ? false : undefined, kind });
}

function parseSmartRow(cells0: string[], opts: FinalizeOpts): ParsedRecord {
  let cells = cells0.map((s) => (s || "").trim());
  if (cells.length === 1) {
    const line = cells[0];
    if ((line.match(/,/g) || []).length >= 3) cells = line.split(",").map((s) => s.trim());
    else if (/[ 　]{2,}/.test(line)) cells = line.split(/[ 　]{2,}/).map((s) => s.trim());
  }
  let fdi = -1;
  for (let i = 0; i < cells.length; i++) {
    if (isDateCell(cells[i])) {
      fdi = i;
      break;
    }
  }
  const baseCells = fdi >= 0 ? cells.slice(0, fdi) : cells.slice();
  const tailCells = fdi >= 0 ? cells.slice(fdi) : [];
  const fields = emptyFields();
  const pc: string[] = [];
  baseCells.forEach((c) => {
    if (!c) return;
    if (RE.mailLoose.test(c)) {
      if (!fields.mail) fields.mail = normalizeMail(c);
      return;
    }
    if (isPhoneCell(c)) {
      if (!fields.phone) fields.phone = normalizePhone(c);
      return;
    }
    if (isPriorityCell(c)) {
      if (!fields.priority) fields.priority = c;
      return;
    }
    if (/^\d+$/.test(c) && c.length <= 4) {
      if (!fields.no) {
        fields.no = c;
        return;
      }
    }
    if (RE.address.test(c) && c.length >= 6 && !fields.address) {
      fields.address = c;
      return;
    }
    if (RE.facility.test(c)) {
      const isCorp =
        /(株式会社|有限会社|合同会社|社会福祉法人|医療法人|学校法人|一般財団法人|公益財団法人|NPO法人|\(株\)|（株）|HD|ホールディングス|グループ|商事|不動産|電鉄|販売|建設|工業|製作所|食品|物産|機構|協会|学園)/.test(c);
      if (isCorp && !fields.corporation) {
        fields.corporation = c;
        return;
      }
      if (!fields.facility) {
        fields.facility = c;
        return;
      }
      if (!fields.corporation) {
        fields.corporation = c;
        return;
      }
    }
    pc.push(c);
  });
  if (!fields.facility && !fields.corporation) {
    const cand = pc.find((c) => c.length <= 40 && !RE.address.test(c) && !RE.sama.test(c) && !RE.samaAnywhere.test(c) && !/^https?:/i.test(c));
    if (cand) {
      fields.facility = cand;
      pc.splice(pc.indexOf(cand), 1);
    }
  }
  if (pc.length) {
    const repCand = pc.find((c) => c.length <= 20 && !RE.address.test(c) && !RE.facility.test(c) && !/^https?:/i.test(c));
    if (repCand) fields.rep = normalizePerson(repCand);
  }
  const callRounds: CallRound[] = [];
  let i = 0;
  while (i < tailCells.length) {
    if (!isDateCell(tailCells[i])) {
      i++;
      continue;
    }
    const round: CallRound = { date: tailCells[i] };
    i++;
    if (i < tailCells.length && isTimeCell(tailCells[i])) {
      round.time = tailCells[i];
      i++;
    }
    if (i < tailCells.length && tailCells[i] && !isDateCell(tailCells[i]) && !isTimeCell(tailCells[i]) && tailCells[i].length <= 30) {
      round.result = tailCells[i];
      i++;
    } else if (i < tailCells.length && tailCells[i] === "") {
      i++;
    }
    if (i < tailCells.length && !isDateCell(tailCells[i])) {
      if (tailCells[i]) round.comment = tailCells[i];
      i++;
    }
    callRounds.push(round);
  }
  return finalizeRecord(fields, callRounds, opts);
}

interface FinalizeOpts {
  /** 資料請求モードなら true（doc優先）。アポ獲得は false。 */
  wantDoc?: boolean;
  kind: Kind;
}

function finalizeRecord(fields: Fields, callRounds: CallRound[], opts: FinalizeOpts): ParsedRecord {
  const wantDoc = !!opts.wantDoc;
  const kind = opts.kind;
  const seen = new Set<string>(),
    uc: CallRound[] = [];
  callRounds.forEach((r) => {
    const sig = `${r.date || ""}|${r.time || ""}|${r.result || ""}|${(r.comment || "").slice(0, 20)}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    uc.push(r);
  });
  const allComments = uc.map((c) => c.comment || "").filter(Boolean);
  const allText = allComments.join("\n");

  let priorityCall: CallRound | undefined;
  if (wantDoc) {
    priorityCall = [...uc].reverse().find((c) => RE.docResult.test(c.result || "") || RE.docResult.test(c.comment || ""));
  } else {
    priorityCall = [...uc].reverse().find((c) => RE.apoResult.test(c.result || ""));
  }
  const latest = priorityCall || (uc.length ? uc[uc.length - 1] : null);

  const orderedComments: string[] = [];
  if (latest && latest.comment) orderedComments.push(latest.comment);
  [...uc].reverse().forEach((c) => {
    if (c !== latest && c.comment) orderedComments.push(c.comment);
  });

  if (!fields.mail) {
    for (const cm of orderedComments) {
      const m = cm.match(RE.mailLoose);
      if (m) {
        fields.mail = m[1];
        break;
      }
    }
  }
  if (!fields.mail) {
    const m = allText.match(RE.mailLoose);
    if (m) fields.mail = m[1];
  }

  let branchName = "",
    branchPhone = "";
  for (const cm of allComments) {
    if (!branchName) {
      const bm = cm.match(/([一-龥ぁ-んァ-ヴー々]{2,15}?)(?:に担当|担当いる|の方が担当|の担当|担当者は)/);
      if (bm) branchName = bm[1];
    }
    if (!branchPhone) {
      const phm = cm.match(RE.phoneLoose);
      if (phm) {
        const ps = normalizePhone(phm[1]);
        if (ps !== fields.phone) branchPhone = ps;
      }
    }
    if (branchName && branchPhone) break;
  }
  const finalPhone = branchPhone || fields.phone || "";

  let finalPerson = "";
  for (const cm of orderedComments) {
    const sn = extractSamaName(cm);
    if (sn) {
      finalPerson = sn;
      break;
    }
  }
  if (!finalPerson && fields.rep) finalPerson = fields.rep;
  if (!finalPerson) finalPerson = "ご担当者様";

  let facilityCombined = fields.facility || fields.corporation || "";
  if (branchName) {
    facilityCombined = facilityCombined ? facilityCombined + "　" + branchName : branchName;
  }

  let scheduleStr = "";
  function buildSchedule(cm: string): string {
    if (!cm) return "";
    if (wantDoc) {
      const dts = extractDateTime(cm);
      const dateStr = dts.length ? dts[0].date : "";
      let method = "";
      if (/メール|mail|@|アドレス/i.test(cm)) method = "メール送付";
      else if (/郵送|郵便|FAX|ファックス|fax|発送|送付|着地|送る|送付希望/i.test(cm)) method = "郵送";
      if (method) {
        let r = method;
        if (dateStr) r += "（" + dateStr + "送付予定）";
        return r;
      } else if (dateStr) {
        return dateStr + " 送付予定";
      }
      return "";
    } else {
      const mt = detectMeetingType(cm, null);
      const dts = extractDateTime(cm);
      const hasTime = dts.length > 0 && dts[0].time;
      const dtStr = dts.length ? dts[0].date + (dts[0].time ? " " + dts[0].time : "") : "";
      const unc = /(以降|以前|頃|あたり|前後|そのあたり|くらい|ぐらい)/.test(cm);
      if (mt && unc) return mt;
      if (mt === "オンライン" || mt === "日程調整中") {
        let r = mt;
        if (hasTime) r += "（" + dtStr + "）";
        return r;
      }
      if (mt === "訪問希望" || mt === "日程確定") return hasTime ? dtStr + "（" + mt + "）" : dts.length ? dts[0].date + " " + mt : mt;
      if (dtStr) return dtStr;
      return "";
    }
  }
  for (const cm of orderedComments) {
    const s = buildSchedule(cm);
    if (s) {
      scheduleStr = s;
      break;
    }
  }

  let noteStr = "";
  if (latest && latest.comment) noteStr = latest.comment.replace(/\r/g, "").replace(/\n{2,}/g, "\n").trim();

  const warnings: string[] = [];
  if (!finalPhone) warnings.push("電話番号なし");
  if (finalPerson === "ご担当者様") warnings.push("担当者名なし");
  if (!facilityCombined) warnings.push("施設名なし");
  if (kind === "report") {
    if (!fields.address) warnings.push("住所なし");
    if (wantDoc) {
      if (!fields.mail && /メール|mail/i.test((latest && latest.comment) || "")) warnings.push("メールアドレスなし");
    } else {
      if (!scheduleStr && latest && RE.apoResult.test(latest.result || "")) warnings.push("日程未抽出／要確認");
    }
  } else {
    if (!fields.mail) warnings.push("メールアドレスなし");
  }

  let detectedStatus: Status | "" = "";
  for (const cm of orderedComments) {
    const s = detectStatusFromText(cm);
    if (s) {
      detectedStatus = s;
      break;
    }
  }
  if (!detectedStatus) {
    const s = detectStatusFromText(allText);
    if (s) detectedStatus = s;
  }
  return {
    schedule: scheduleStr,
    facility: facilityCombined,
    address: fields.address || "",
    person: finalPerson,
    phone: finalPhone,
    mail: fields.mail || "",
    note: noteStr,
    dept: fields.dept_unit || "",
    status: detectedStatus,
    statusAuto: !!detectedStatus,
    warnings,
  };
}

/**
 * 貼り付けテキストを解析してレコード配列を返す（既存 doParse 相当）。
 * 1件貼り→1レコード、複数行貼り→複数レコード（まとめ貼り対応）。
 * @param text  スプレッドシートからの貼り付け（TSV/カンマ/空白区切り）
 * @param outcome  アポ獲得 or 資料請求
 */
export function parseInput(text: string, outcome: Outcome, kind: Kind = "report"): ParsedRecord[] {
  const rows = parseTSV(text || "");
  if (!rows.length) return [];
  let headerMap: (string | null)[] | null = null;
  let dataRows = rows;
  if (rows.length >= 2 && detectHeader(rows[0].join("\t"))) {
    headerMap = rows[0].map((h) => classifyHeader(h));
    dataRows = rows.slice(1);
  }
  dataRows = dataRows.filter((cells) => cells.some((c) => (c || "").trim()));
  const wantDoc = outcomeWantsDoc(outcome);
  return dataRows.map((cells) => (headerMap ? parseRowWithHeader(cells.join("\t"), headerMap, kind) : parseSmartRow(cells, { wantDoc, kind })));
}

// ===== メール生成 =====
export interface MailFormValues {
  serviceName?: string;
  serviceUrl?: string;
  content?: string; // 面談内容
  link?: string; // ミーティングURL
  datetime?: string; // 日時
  docs?: string; // 送付資料（カンマ/読点区切り）
  nextstep?: string; // 次回連絡
  dept?: string; // 事業部（上書き用）
}
export interface Signature {
  intro: string; // 名乗り
  block: string; // 署名
}
export interface MailTemplate {
  label?: string;
  subject: string;
  body: string;
}

function buildVars(r: ParsedRecord, mailType: MailType, form: MailFormValues, sig: Signature): Record<string, string> {
  const company = r.facility && r.facility.trim() ? r.facility.trim() : TODO;
  const dept = (r.dept || "").trim() || (form.dept || "").trim();
  let personLine: string;
  if (r.person && r.person.trim()) {
    const p = r.person.trim();
    personLine = /(様|さん|御中|殿)\s*$/.test(p) ? p : p + " 様";
  } else {
    personLine = "ご担当者様";
  }
  const addrLines = [company];
  if (dept) addrLines.push(dept);
  addrLines.push(personLine);
  const addressBlock = addrLines.join("\n");

  const intro = (sig.intro || "").trim();
  const block = (sig.block || "").trim();

  let svcName = "",
    svcUrl = "",
    content = "",
    link = "",
    dt = "",
    docs = "",
    next = "";
  if (mailType === "meeting") {
    svcName = (form.serviceName || "").trim();
    svcUrl = (form.serviceUrl || "").trim();
    content = (form.content || "").trim();
    link = (form.link || "").trim();
    dt = (form.datetime || "").trim();
  } else {
    svcName = (form.serviceName || "").trim();
    svcUrl = (form.serviceUrl || "").trim();
    const draw = (form.docs || "").trim();
    docs = draw ? draw.split(/[,、]/).map((s) => "・" + s.trim()).join("\n") : "";
    next = (form.nextstep || "").trim() || "お電話にてご状況を伺えればと存じます。";
  }
  return {
    "{宛名}": addressBlock,
    "{会社名}": company,
    "{事業部}": dept,
    "{氏名様}": personLine,
    "{名乗り}": intro,
    "{署名}": block,
    "{サービス名}": svcName || TODO,
    "{サービスURL}": svcUrl || TODO,
    "{面談内容}": content || TODO,
    "{リンク}": link || TODO,
    "{日時}": dt || TODO,
    "{送付資料}": docs,
    "{次回連絡}": next,
    "{個別メッセージ}": (r.aiMsg || "").trim(),
    "{施設名}": r.facility || TODO,
  };
}

export function fillTemplate(str: string, vars: Record<string, string>): string {
  if (!str) return "";
  let out = str.replace(/\{[^}]+\}/g, (m) => (m in vars ? vars[m] : m));
  out = out.replace(/\n{3,}/g, "\n\n");
  return out.trim() + "\n";
}

export interface RenderedMail {
  subject: string;
  body: string;
  usedStatus: Status;
}

/** レコード＋テンプレ＋フォーム値＋署名から、件名・本文を生成 */
export function renderMail(
  r: ParsedRecord,
  mailType: MailType,
  status: Status,
  template: MailTemplate,
  form: MailFormValues,
  sig: Signature,
): RenderedMail {
  const st = (r.status || status) as Status;
  const vars = buildVars(r, mailType, form, sig);
  return {
    subject: fillTemplate(template.subject || "", vars),
    body: fillTemplate(template.body || "", vars),
    usedStatus: st,
  };
}
