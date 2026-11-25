const EXAMPLES = ['TrangXinhGai01', 'HungDepTrai02', 'CuongXamVL321', 'HungYeuTrang@fake.com',
  'Huy0Suy123', 'CauBeCoDon0908', 'DoiVitLaSo1', 'ChanCauLong', 'ThichMauHuongGhetSuGiaDoi', '⪑특꧁҉문⫸҉제⫷҉조꧂҉기⪒',
  'AnhHaNewbie', 'TB+_Thi_Doi_Ten', 'Pham_Vu_Lin_Dan', 'Lee_Chong_Trang', 'Danh_Dau_Truot_Do', 'DapCauNhuPhong'];

// Passed to a lazy useState so the name is drawn once per screen visit, not on every keystroke.
export function pickUsernameExample(): string {
  return EXAMPLES[Math.floor(Math.random() * EXAMPLES.length)] ?? EXAMPLES[0] ?? '';
}
