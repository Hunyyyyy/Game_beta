// The stone-age tree (doc/story_tree.md, Thân I-III) as tables for tools/gen-story.mjs. Ids are written without their prefix; the generator adds it.
// o(text, reply, marks, extra): an answer; marks 'uy+2 tin-1' become a deed of its own (extra.deed names it). sc(cast, say, ...answers): a scene.
export const o = (text, reply, marks = '', extra = {}) => ({ text, reply, marks, ...extra });
export const sc = (cast, say, ...options) => ({ cast, say: [].concat(say), options });
const old = (label, ...deeds) => ({ label, deeds });

export const threads = [
  { id: 'I.A', name: 'Bếp lửa mở', trunk: 'I', chapters: [
    { name: 'Kẻ lang thang', script: 'wanderer', options: [old('Cho một bữa ăn', 'helped_wanderer'), old('Giữ lại làm việc', 'took_in_wanderer'), old('Đuổi đi', 'refused_wanderer')] },
    { name: 'Đoàn người đi đường', script: 'travelers', options: [old('Cho nghỉ lại', 'hosted_travelers'), old('Không tiếp')] },
    { name: 'Bữa tối chung', when: 'deed.took_in_wanderer+deed.took_refugees+deed.took_in_thief>=1', days: [2, 4], scene: sc('elder', ['Trong làng giờ có người từ ngoài tới. Có người đề nghị nấu chung một bữa tối ngoài bãi.', 'Bữa đó ngồi thế nào?'],
      o('Một vòng lửa chung, ai cũng ngồi chung.', 'Đêm đó không ai hỏi ai từ đâu tới.', 'hop+2 nhan+1 lo+1', { deed: 'shared_fire' }),
      o('Hai bếp: người cũ một bên, người mới một bên.', 'Hai đống lửa cách nhau mười bước chân.', 'hop-1 lo-1', { deed: 'two_hearths' }),
      o('Giao người mới gác đêm nay.', 'Người mới cầm giáo đứng ở cổng, lưng thẳng hẳn lên.', 'tin+2 hop+1 lo+2', { deed: 'newcomer_watch' }),
      o('Mời người lạ kể chuyện quanh lửa.', 'Họ kể về những con đường bên kia đồi. Thật hay không thì chưa biết.', 'tin+1 hop+1', { deed: 'fire_tales' })) },
  ] },
  { id: 'I.B', name: 'Bước chân sau lưng', trunk: 'I', chapters: [
    { name: 'Ba người chạy trốn', script: 'refugees', options: [old('Nhận cả ba', 'took_refugees'), old('Cho ăn rồi tiễn', 'fed_refugees'), old('Từ chối', 'refused_refugees')] },
    { name: 'Kẻ đuổi theo', script: 'pursuers', options: [old('Giao họ ra', 'handed_over'), old('Trả lương cho họ rút', 'paid_pursuers'), old('Không giao', 'defied_pursuers')] },
    { name: 'Lời kể của người sống sót', when: 'deed.took_refugees>=1', days: [3, 6], scene: sc('elder', ['Người được làng giữ lại cuối cùng cũng chịu kể vì sao họ bị đuổi.', 'Làng làm gì với điều vừa nghe?'],
      o('Tin, và dùng nó để dò đường.', 'Lời kể chỉ ra một lối mòn mà làng chưa từng biết.', 'tin+1 lo+1'),
      o('Giữ kín chuyện này.', 'Chuyện ở lại quanh bếp lửa. Người kể thấy mình được che chở.', 'lo-1 hop+1'),
      o('Dâng họ cho làng kia để đổi lấy thiện cảm.', 'Họ bị dẫn đi lúc trời chưa sáng. Không ai trong làng nhìn theo.', 'nhan-2 tin+1')) },
  ] },
  { id: 'II.A', name: 'Kẻ đòi phần', trunk: 'II', chapters: [
    { name: 'Do thám Rìu Đá', script: 'scout_envoy', options: [old('Tiếp đàng hoàng', 'hosted_scouts'), old('Dẫn đi xem lính gác', 'showed_force'), old('Để lộ làng yếu', 'showed_weakness'), old('Đuổi đi', 'drove_off_scouts')] },
    { name: 'Đòi cống', script: 'extortion', options: [old('Trả đủ', 'paid_tribute'), old('Dọa lại bằng hàng lính', 'scared_off_tribute'), old('Dọa hụt', 'bluff_failed'), old('Từ chối', 'refused_tribute')] },
    { name: 'Tối hậu thư', script: 'ultimatum', options: [old('Nộp để họ rút hẳn', 'bought_peace'), old('Nộp để họ hoãn', 'bought_time'), old('Thách đánh', 'defied_ultimatum')] },
  ] },
  { id: 'II.B', name: 'Con tin và đường về', trunk: 'II', chapters: [
    { name: 'Người bị giữ', script: 'ransom', options: [old('Trả chuộc', 'paid_ransom'), old('Không trả', 'refused_ransom')] },
    { name: 'Trao trẻ', days: [4, 8], scene: sc('envoy', ['Bên kia đề nghị: mỗi làng gửi một đứa trẻ sang làng kia ở một mùa.', 'Trẻ con ở nhà nhau thì người lớn khó cầm giáo với nhau.'],
      o('Gửi một đứa trẻ của làng sang.', 'Đứa trẻ đi, ngoái lại ba lần.', 'tin+3 hop+1', { deed: 'sent_child' }),
      o('Nhận đứa trẻ của họ về nuôi.', 'Đứa trẻ lạ ngồi nép bên bếp, rồi dần dần xích lại.', 'hop+2 nhan+1 lo+1', { deed: 'took_child' }),
      o('Từ chối.', 'Sứ giả gật đầu, không nói gì thêm.', 'tin-1')) },
    { name: 'Mùa học việc', days: [10, 15], scene: sc('envoy', ['Một mùa đã qua. Đứa trẻ đến tuổi về.', 'Bên kia đang chờ câu trả lời của làng.'],
      o('Cho về đúng hẹn.', 'Lời hứa được giữ. Bên kia nhớ điều đó.', 'tin+1'),
      o('Giữ lại thêm một mùa.', 'Đứa trẻ ở lại. Bên kia đếm từng ngày.', 'hop+1 tin-2'),
      o('Xin cho ở lại như họ hàng của cả hai bên.', 'Hai làng giờ có chung một đứa cháu.', 'hop+2 tin+1', { cond: 'deed.sent_child+deed.took_child>=1' })) },
  ] },
  { id: 'III.A', name: 'Chợ đường xa', trunk: 'III', chapters: [
    { name: 'Gánh hàng đầu tiên', script: 'peddler', options: [old('Xem hàng')] },
    { name: 'Món chịu', days: [3, 6], scene: sc('merchant', ['Tôi có một lô vật liệu, bán chịu cho làng bạn. Mười ngày sau trả bằng vỏ sò.', 'Chữ tín quý hơn vỏ sò, phải không?'],
      o('Mua chịu.', 'Hàng để lại, người đi. Mười ngày nữa hắn sẽ quay lại.', 'tin+2', { give: { wood: 20, stone: 10 } }),
      o('Trả sòng phẳng ngay.', 'Tiền trao cháo múc. Hắn ghi nhớ làng này.', 'tin+1', { take: { coin: 2 }, give: { wood: 20, stone: 10 } }),
      o('Không buôn bán gì cả.', 'Hắn nhún vai, gánh hàng đi tiếp.', 'tin-1 lo-1')) },
    { name: 'Đường muối', days: [3, 6], scene: sc('merchant', ['Bên kia đồi có một mỏ muối. Tôi biết đường, và tôi bán bản đồ.', 'Muối giữ thịt qua mùa đông. Làng bạn tính sao?'],
      o('Cử ba người đi tìm mỏ.', 'Ba người lên đường lúc rạng sáng.', 'lo+1 tin+1', { deed: 'salt_party' }),
      o('Mua bản đồ trước rồi tính.', 'Một mảnh da vẽ nguệch ngoạc. Đúng hay sai thì phải đi mới biết.', 'tin+1', { take: { coin: 1 } }),
      o('Không đi.', 'Muối vẫn ở bên kia đồi, và làng vẫn ở bên này.', 'lo-1')) },
  ] },
  { id: 'III.B', name: 'Lửa và mùa', trunk: 'III', chapters: [
    { name: 'Kho lương vơi dần', when: 'fireLevel>=2', days: [1, 3], scene: sc('elder', ['Cuối thu rồi, mà kho lương vơi nhanh hơn mọi năm.', 'Làng lo cho mùa đông thế nào?'],
      o('Tích trữ, khóa kho.', 'Kho đầy lên. Cả vùng cũng biết làng này có của.', 'lo+1', { deed: 'stored_winter' }),
      o('Chia đều qua bữa ăn chung.', 'Mỗi tối cả làng ăn cùng một nồi.', 'nhan+1 hop+1', { deed: 'shared_meals' }),
      o('Đổi bớt lương lấy vũ khí.', 'Bụng lép hơn một chút, tay chắc hơn một chút.', 'uy+1', { deed: 'food_for_arms' })) },
    { name: 'Người giữ lửa', days: [3, 6], scene: sc('firekeeper', ['Đêm qua bão tắt lửa Nhà chung. Cả làng lạnh một đêm.', 'Lửa không tự giữ được mình. Ai giữ nó?'],
      o('Lập người giữ lửa, luân phiên mỗi đêm một người.', 'Từ nay đêm nào cũng có một người thức với lửa.', 'tin+1 hop+1', { deed: 'fire_keeper' }),
      o('Mỗi nhà tự giữ lửa nhà mình.', 'Nhà nào lo nhà nấy. Nhà chung tối hơn trước.', 'hop-1', { deed: 'own_fires' }),
      o('Giao cho người mới tới, người ấy khéo giữ lửa.', 'Người lạ hôm nào giờ ngồi cạnh thứ quý nhất của làng.', 'hop+2 lo+1', { deed: 'outsider_keeper' })) },
    { name: 'Vòng đá trên đồi', days: [3, 6], scene: sc('elder', ['Dân đề nghị dựng một vòng đá lớn trên đồi để xin mùa.', 'Có người lại bảo: dựng tường quanh làng thì thiết thực hơn.'],
      o('Dựng vòng đá.', 'Mười lăm ngày công. Vòng đá đứng đó, nhìn xuống làng.', 'tin+2 hop+1', { deed: 'stone_ring' }),
      o('Dựng tường rào dày quanh làng.', 'Tường cao lên, và bên ngoài thấy ít hơn về làng.', 'uy+2 lo-2 hop-1', { deed: 'thick_wall' }),
      o('Không dựng gì, để công cho việc khác.', 'Việc ai nấy làm, như mọi ngày.')) },
  ] },
];

// leaves of a knot: [leaf, base weight, affinity 'mark:x mark:y', tilts [[cond, mul], ...]]
export const knots = [
  { id: 'I-1', name: 'Đêm không ai ngủ', trunk: 'I', fedBy: ['I.A'], chapters: 2, progress: [0.25, 0.45], cond: 'mark.hop+mark.lo>=5', fallback: 'I1-nhat', leaves: [
    ['I1-a', 3, 'hop:0.5 nhan:0.4', [['deed.shared_fire>=1', 1.5]]], ['I1-b', 2, 'lo:0.5', [['deed.newcomer_watch>=1', 1.5], ['deed.two_hearths>=1', 1.3]]],
    ['I1-c', 2, 'hop:0.3 nhan:-0.3'], ['I1-d', 2, 'nhan:0.3 tin:0.4', [['deed.fire_tales>=1', 1.5]]]] },
  { id: 'I-2', name: 'Tiếng gọi từ phía sương', trunk: 'I', fedBy: ['I.B'], chapters: 2, progress: [0.35, 0.55], cond: 'mark.nhan+mark.uy+mark.tin>=4', fallback: 'I2-nhat', leaves: [
    ['I2-a', 2, 'tin:0.5', [['deed.paid_pursuers+deed.handed_over>=1', 1.5]]], ['I2-b', 2, 'uy:0.5', [['deed.defied_pursuers>=1', 1.6]]],
    ['I2-c', 2, 'nhan:0.4 hop:0.4'], ['I2-d', 1, 'lo:0.4 nhan:-0.4', [['deed.handed_over>=1', 2]]]] },
  { id: 'II-1', name: 'Ngày đòi nợ', trunk: 'II', fedBy: ['II.A'], chapters: 2, progress: [0.45, 0.65], fallback: 'II1-nhat', leaves: [
    ['II1-a', 2, 'uy:-0.4 lo:0.4', [['deed.paid_tribute>=2', 2]]], ['II1-b', 2, 'uy:0.5', [['deed.scared_off_tribute+deed.showed_force>=1', 1.5]]],
    ['II1-c', 2, 'tin:0.5', [['deed.hosted_scouts>=1', 1.5]]], ['II1-d', 1, 'uy:-0.4 lo:0.4', [['deed.bluff_failed>=1', 2]]]] },
  { id: 'II-2', name: 'Đứa trẻ bên kia', trunk: 'II', fedBy: ['II.B'], chapters: 2, progress: [0.5, 0.7], cond: 'mark.tin+mark.hop>=4', fallback: 'II2-nhat', leaves: [
    ['II2-a', 2, 'tin:0.5', [['deed.sent_child>=1', 1.6]]], ['II2-b', 2, 'hop:0.5', [['deed.took_child>=1', 1.6]]],
    ['II2-c', 1, 'nhan:-0.4 lo:0.4'], ['II2-d', 2, 'tin:0.4', [['deed.paid_ransom>=1', 1.5]]]] },
  { id: 'III-1', name: 'Đường vỏ sò', trunk: 'III', fedBy: ['III.A'], chapters: 2, progress: [0.3, 0.5], cond: 'mark.tin>=3', fallback: 'III1-nhat', leaves: [
    ['III1-a', 3, 'tin:0.5'], ['III1-b', 2, 'lo:0.5'], ['III1-c', 2, 'tin:0.2', [['deed.salt_party>=1', 2.5]]], ['III1-d', 1, 'uy:-0.4 lo:0.4']] },
  { id: 'III-2', name: 'Mùa đông dài', trunk: 'III', fedBy: ['III.B'], chapters: 2, progress: [0.55, 0.7], fallback: 'III2-nhat', leaves: [
    ['III2-a', 3, 'nhan:0.4 hop:0.4', [['deed.shared_meals>=1', 1.5]]], ['III2-b', 2, 'lo:0.4 hop:-0.4', [['deed.stored_winter>=1', 1.3]]],
    ['III2-c', 2, 'tin:0.3', [['deed.fire_keeper+deed.outsider_keeper>=1', 1.5], ['deed.stone_ring>=1', 1.5]]], ['III2-d', 2, 'uy:0.4', [['deed.thick_wall>=1', 2]]]] },
];

const AXE = 'axe', CAVE = 'cave';
export const leaves = [
  { id: 'I1-a', name: 'Xóm mới', text: 'Đêm đó người mới dựng mái nhà riêng bên rìa làng, gọi là "bếp thứ hai". Làng đông thêm, và có thêm một tiếng nói riêng.', flags: ['xom_moi'], effects: [{ give: { wood: 20 } }] },
  { id: 'I1-b', name: 'Nội gián mở cổng', text: 'Người được tin giao gác đã mở lối. Sáng ra kho lương vơi hẳn.', hard: true, flags: ['noi_gian'], effects: [{ take: { food: 30 } }, { deed: 'betrayed_gate' }, { raid: { tribe: AXE, size: 3 } }] },
  { id: 'I1-c', name: 'Bệnh sốt từ đường xa', text: 'Một phần ba dân nằm liệt sáu ngày. Việc đồng áng bỏ dở.', hard: true, flags: ['benh_sot'], effects: [{ take: { food: 20 } }] },
  { id: 'I1-d', name: 'Người có tài', text: 'Một người được nhận hóa ra có tay nghề hiếm. Cả làng học được đôi điều.', flags: ['nhan_tai'], effects: [{ give: { stone: 20, coin: 2 } }] },
  { id: 'I1-nhat', name: 'Một đêm dài', text: 'Đêm đó ai cũng thức, nhưng rồi không có gì xảy ra.' },
  { id: 'I2-a', name: 'Kẻ đuổi thành sứ giả', text: 'Thủ lĩnh nhóm đuổi quay lại một mình, không vũ khí: bên kia muốn nói chuyện.', flags: ['su_gia'], effects: [{ rel: { tribe: AXE, n: 8 } }] },
  { id: 'I2-b', name: 'Chiến thắng đầu tiên', text: 'Bên kia kéo tới trả thù và bị đánh bật. Vũ khí họ bỏ lại giờ treo ở Nhà chung.', needs: 'soldiers>=10', alt: 'I2-b2', flags: ['thang_dau'], effects: [{ deed: 'first_victory' }, { give: { hide: 15 } }, { raid: { tribe: AXE, size: 5 } }] },
  { id: 'I2-b2', name: 'Trận thua đầu tiên', text: 'Bên kia kéo tới trả thù. Làng quá ít lính: mất lương, và cả vùng biết làng yếu.', flags: ['thua_dau'], effects: [{ deed: 'lost_fight' }, { take: { food: 30 } }, { raid: { tribe: AXE, size: 5 } }] },
  { id: 'I2-c', name: 'Tiếng lành đồn xa', text: 'Người được cứu kể lại ở làng cũ. Người ta bắt đầu tìm đến xin ở nhờ.', flags: ['tieng_lanh'], effects: [{ deed: 'good_name' }, { give: { food: 15 } }] },
  { id: 'I2-d', name: 'Người bị bỏ lại trở về', text: 'Người từng bị giao nộp quay lại, dẫn theo kẻ cướp biết rõ kho làng ở đâu.', hard: true, flags: ['no_mau'], effects: [{ take: { food: 25 } }, { raid: { tribe: AXE, size: 4 } }] },
  { id: 'I2-nhat', name: 'Sương tan không tiếng', text: 'Tiếng gọi xa dần rồi tắt. Không ai tới nữa.' },
  { id: 'II1-a', name: 'Vòng xoáy cống nạp', text: 'Giá đòi tăng sau mỗi lần trả, dần thành "thuế mùa". Trả thì yên, nhưng mùa nào cũng mất một phần.', hard: true, flags: ['chu_no'], effects: [{ take: { food: 30, coin: 2 } }] },
  { id: 'II1-b', name: 'Làng cứng đầu', text: 'Rìu Đá quay sang gặm làng khác. Tên làng bạn thành cái tên được nể sợ.', flags: ['uy_danh'], effects: [{ deed: 'feared_name' }] },
  { id: 'II1-c', name: 'Lưỡi rìu chia hai', text: 'Trong Rìu Đá có hai phe: phe chiến muốn đánh, phe hòa muốn buôn. Họ nhờ làng làm bên thứ ba.', flags: ['rieu_phe'],
    scene: sc('envoy', ['Rìu Đá chia hai phe, và cả hai cùng cử người tới.', 'Làng đứng về bên nào?'],
      o('Ủng hộ phe chiến.', 'Phe chiến thắng thế. Họ nhớ ai đã đứng cạnh, và ai sẽ là mồi tiếp theo.', 'uy+1 tin-1'),
      o('Ủng hộ phe hòa.', 'Phe hòa lên tiếng to hơn. Đường buôn mở thêm một lối.', 'tin+2', { rel: 6 }),
      o('Đứng ngoài.', 'Hai phe tự giải quyết với nhau. Không ai nợ làng điều gì.')) },
  { id: 'II1-d', name: 'Kẻ đòi nợ lớn hơn', text: 'Rìu Đá và Hang Gấu bắt tay. Một liên quân kéo tới.', hard: true, flags: ['lien_quan'], effects: [{ raid: { tribe: AXE, size: 8 } }] },
  { id: 'II1-nhat', name: 'Món nợ treo đó', text: 'Kẻ đòi phần không tới nữa, cũng không ai nói là đã thôi.' },
  { id: 'II2-a', name: 'Cầu nối', text: 'Người trở về nói được tiếng bên kia, mang theo cả tay nghề của họ.', flags: ['cau_noi'], effects: [{ rel: { tribe: AXE, n: 12 } }, { give: { stone: 15 } }] },
  { id: 'II2-b', name: 'Đứa trẻ hai làng', text: 'Đứa trẻ lớn lên trong làng bạn và không muốn về. Bên kia coi đó là một món nợ.', flags: ['hai_dong_mau'], effects: [{ rel: { tribe: AXE, n: 4 } }] },
  { id: 'II2-c', name: 'Con tin chết', text: 'Đứa trẻ ở làng bạn chết. Không ai bên kia tin đó là tai nạn.', hard: true, flags: ['no_mau'], effects: [{ rel: { tribe: AXE, n: -30 } }] },
  { id: 'II2-d', name: 'Hội đồng lửa', text: 'Hai làng thề không đánh nhau một mùa, dưới ngọn lửa của một làng thứ ba.', flags: ['hoi_dong_lua'], effects: [{ rel: { tribe: AXE, n: 6 } }, { rel: { tribe: CAVE, n: 6 } }] },
  { id: 'II2-nhat', name: 'Đứa trẻ về nhà', text: 'Đứa trẻ về lại làng mình. Hai bên lại như hai người lạ.' },
  { id: 'III1-a', name: 'Chợ cổng làng', text: 'Thương lái ghé định kỳ, dựng sạp ngoài cổng: một phiên chợ nhỏ.', flags: ['cho_cong'], mods: { marketQuota: 1.2 } },
  { id: 'III1-b', name: 'Vỏ sò mất giá', text: 'Vỏ sò giả tràn vào. Ai cũng nghi ai.', hard: true, flags: ['vo_so_gia'], mods: { marketFee: 1.25 }, modDays: 15, effects: [{ deed: 'bad_shells' }] },
  { id: 'III1-c', name: 'Mỏ muối', text: 'Đoàn người tìm ra mỏ muối: thịt khô giữ được lâu hơn. Nhưng mỏ nằm trên đất tranh chấp.', flags: ['mo_muoi'], effects: [{ give: { food: 30 } }] },
  { id: 'III1-d', name: 'Thương lái bị cướp', text: 'Một thương lái bị cướp và chết trên đường quanh làng. Các làng đổ lỗi cho nhau.', flags: ['duong_du'], mods: { marketQuota: 0.8 }, modDays: 20 },
  { id: 'III1-nhat', name: 'Đường vắng', text: 'Thương lái thưa dần. Không ai nói vì sao.' },
  { id: 'III2-a', name: 'Mùa đông chia đều', text: 'Tuyết phủ mười hai ngày. Ai cũng bớt miếng ăn, nhưng không ai bị bỏ lại.', flags: ['ngay_chia'], effects: [{ deed: 'winter_shared' }] },
  { id: 'III2-b', name: 'Mùa đông giành giật', text: 'Lương vơi nhanh, bè phái chia nhau kho. Một nhóm đòi tách đi.', hard: true, flags: ['phan_ly'], effects: [{ take: { food: 40 } }] },
  { id: 'III2-c', name: 'Lửa thiêng', text: 'Người giữ lửa thành người chỉ ngày nhóm lửa, ngày dọn kho. Hang Gấu nghe tin và kính trọng.', flags: ['lua_thieng'], effects: [{ rel: { tribe: CAVE, n: 10 } }] },
  { id: 'III2-d', name: 'Tường cứu mạng', text: 'Đêm tuyết, bầy sói tràn xuống; tường và cổng chặn được. Sáng ra, có người xin trú đã nằm ngoài tuyết.', flags: ['cua_dong'], effects: [{ deed: 'wall_saved' }] },
  { id: 'III2-nhat', name: 'Một mùa đông như mọi mùa', text: 'Mùa đông qua đi. Không ai kể gì về nó.' },
];

export const wild = [
  { id: 'B1', name: 'Sao chổi', text: 'Một vệt lửa vắt ngang trời bảy đêm. Dân làng ngồi nhìn, không ai nói gì.', effects: [{ deed: 'comet' }] },
  { id: 'B2', name: 'Bầy thú di cư', text: 'Hàng trăm con thú đi qua thung lũng năm ngày liền.', effects: [{ give: { food: 40, hide: 10 } }] },
  { id: 'B3', name: 'Đứa bé bị bỏ lại', text: 'Một đứa bé nằm trước cổng làng, không ai nhận.',
    scene: sc('firekeeper', ['Đứa bé khóc trước cổng từ lúc trời chưa sáng.', 'Không ai biết nó là con ai.'], o('Nhận nuôi.', 'Một nhà trong làng bế đứa bé vào.', 'nhan+2 hop+1'), o('Không nhận.', 'Tiếng khóc xa dần.', 'nhan-1')) },
  { id: 'B4', name: 'Mưa đá', text: 'Một trận đá đập nát ruộng và giàn phơi.', effects: [{ take: { food: 25 } }] },
  { id: 'B5', name: 'Mảnh sắt trời', text: 'Một tảng đá cháy rơi xuống đồi. Mảnh kim loại đen ấy đập không vỡ.', flags: ['sat_troi'] },
  { id: 'B6', name: 'Tiếng trống từ sương', text: 'Ba đêm liền nghe trống từ rìa thung lũng: một bộ tộc xa đang tiến vào.', flags: ['trong_suong'], effects: [{ deed: 'far_drums' }] },
];

export const fruits = [
  { id: 'T1', name: 'Làng Mở', needs: ['I1-a', 'I2-c', 'III2-a'], flag: 'lang_mo', text: 'Ngoài vùng ai cũng biết: đến đó là có chỗ ngồi bên lửa. Người cũ và xóm mới tranh nhau ai được nói.',
    scene: sc('elder', ['Người cũ và người mới đều muốn có tiếng nói trong việc làng.', 'Ai được ngồi ở vòng trong?'], o('Lập hội đồng chung, có người của xóm mới.', 'Vòng lửa rộng thêm. Việc gì cũng bàn lâu hơn.', 'hop+2'), o('Giữ quyền ở người cũ.', 'Người mới im lặng, nhưng họ nhớ.', 'hop-2 uy+1'), o('Bốc thăm.', 'Que ngắn que dài quyết định. Không ai cãi được với que.', 'tin+1')) },
  { id: 'T2', name: 'Làng Kín', needs: ['III2-d', ['I1-b', 'I2-d']], flag: 'lang_kin', text: 'Sau khi bị phản và sau đêm tuyết bỏ người ngoài cửa, làng đặt luật: qua cổng phải có người bảo lãnh.',
    scene: sc('elder', ['Có người đề nghị: từ nay ai qua cổng cũng phải có người trong làng bảo lãnh.'], o('Luật bảo lãnh cho mọi người.', 'Cổng hẹp lại. Trong làng yên, và lặng.', 'lo-3 hop-2'), o('Chỉ đóng với nhóm đã phản.', 'Cổng vẫn mở, trừ với vài cái tên.'), o('Hủy luật.', 'Cổng mở như cũ. Có người lắc đầu.', 'nhan+1 lo+2')) },
  { id: 'T3', name: 'Kẻ Nộp Cống', needs: ['II1-a', 'III1-b'], flag: 'ke_nop_cong', text: 'Vỏ sò mất giá mà cống vẫn tính theo vỏ sò. Người đòi mang theo cân riêng.',
    scene: sc('envoy', ['Cống mùa này, tính theo cân của chúng tôi.'], o('Nộp bằng lương thực.', 'Kho hụt đi một góc.', 'nhan-1', { take: { food: 30 } }), o('Vay thương lái để nộp.', 'Cống nộp đủ. Giờ làng nợ một người khác.', 'tin+1'), o('Nổi dậy.', 'Cái cân bị đập vỡ trước cổng.', 'uy+2', { raid: 6 })) },
  { id: 'T4', name: 'Làng Rìu Cứng', needs: ['II1-b', 'I2-b', 'III2-d'], flag: 'rieu_cung', text: 'Tiếng thắng trận bay xa. Thanh niên đòi vào lính.',
    scene: sc('general', ['Trai làng đứng đầy trước Nhà chung, xin được cầm giáo.'], o('Lập đội lính thường trực.', 'Từ nay có người chỉ làm một việc: giữ làng.', 'uy+2'), o('Giữ dân binh, khi cần mới gọi.', 'Giáo treo trong nhà, bên cạnh cuốc.', 'hop+1'), o('Thuê người ngoài làm lính.', 'Người lạ cầm giáo đứng ở cổng làng.', 'tin-1 lo+1')) },
  { id: 'T5', name: 'Cầu Bốn Tộc', needs: ['II2-a', ['III1-a', 'III1-d'], 'II1-c'], flag: 'cau_bon_toc', text: 'Làng thành nơi các làng gặp nhau, vì ai cũng tin người nói được tiếng cả bốn bên.',
    scene: sc('merchant', ['Bốn làng muốn có một chỗ gặp nhau, và họ chọn làng bạn.'], o('Họp chợ chung mỗi mười lăm ngày.', 'Bãi trước cổng thành bãi chợ.', 'tin+2 lo+2'), o('Lập luật đường, thu phí qua lại.', 'Ai qua đường cũng để lại một ít.', 'uy+2'), o('Giữ riêng, không nhận.', 'Họ tìm chỗ khác mà họp.')) },
  { id: 'T6', name: 'Đàn Lửa', needs: ['III2-c', 'II2-d', 'B1'], flag: 'dan_lua', text: 'Hang Gấu cử người tới nhóm lửa chung ở vòng đá. Các làng khác bắt đầu tìm đến.',
    scene: sc('firekeeper', ['Người các làng đứng dưới chân đồi, xin được lên chỗ lửa.'], o('Mở đàn cho mọi làng.', 'Lửa của làng giờ là lửa của cả vùng.', 'tin+3 lo+1'), o('Giữ đàn cho riêng làng mình.', 'Họ đứng dưới chân đồi một lúc, rồi về.', 'uy+1 tin-1')) },
  { id: 'T7', name: 'Nợ Máu', needs: ['II2-c', 'I2-d', 'II1-d'], flag: 'no_mau_sau', text: 'Hai món nợ cùng lúc: một người chết ở làng bạn, một người bị bỏ rơi dẫn đường cho kẻ cướp.',
    scene: sc('elder', ['Máu đã đổ ở cả hai bên. Làng trả lời thế nào?'], o('Tìm cách đền bù.', 'Của cải đi theo người đưa tin. Chưa chắc đã đủ.', 'nhan+2', { take: { food: 30 } }), o('Thề trả thù.', 'Lời thề được nói to trước lửa.', 'uy+3 tin-3'), o('Giấu chuyện.', 'Không ai nhắc lại. Nhưng chuyện vẫn ở đó.', 'lo+2')) },
  { id: 'T8', name: 'Kim Loại Trời', needs: ['I1-d', 'III1-c', 'B5'], flag: 'kim_loai_som', text: 'Người thợ giỏi, mỏ muối đã mở đường, và mảnh sắt trời nằm trên bàn. Ông thử nung.',
    scene: sc('old_master', ['Tôi chưa thấy thứ đá nào như thế này. Cho tôi thử với nó.'], o('Dốc công thử rèn.', 'Lò đỏ nhiều đêm liền. Thứ đen ấy bắt đầu chịu búa.', 'uy+1', { take: { wood: 30 } }), o('Giữ làm báu vật.', 'Mảnh sắt trời được đặt ở Nhà chung.', 'tin+2'), o('Đổi cho làng khác.', 'Nó đi, và tiếng về làng bạn đi theo nó.', 'lo+2', { rel: 8 })) },
  { id: 'T9', name: 'Hai Dòng Máu', needs: ['II2-b', 'I2-a'], flag: 'hon_uoc', text: 'Hai người lớn lên ở hai làng xin được nên vợ nên chồng.',
    scene: sc('envoy', ['Hai đứa nó đã quyết. Giờ đến lượt hai làng.'], o('Cho lấy nhau.', 'Một đám cưới, hai làng cùng ăn.', 'tin+3 hop+2', { rel: 10 }), o('Cấm.', 'Hai đứa không nhìn mặt ai trong nhiều ngày.', 'tin-2'), o('Làm lễ nhận họ giữa hai làng.', 'Từ nay hai làng gọi nhau là họ hàng.', 'hop+3', { rel: 6 })) },
  { id: 'T10', name: 'Làng Chia Đôi', needs: ['III2-b', ['I1-c', 'I1-b']], flag: 'lang_con', text: 'Một nhóm người tách đi, dựng "làng con" bên kia suối.',
    scene: sc('elder', ['Họ đã gói đồ. Làng tiễn họ thế nào?'], o('Cho đi, kèm lương thực.', 'Họ đi, và ngoái lại vẫy.', 'nhan+2', { take: { food: 25 } }), o('Đuổi.', 'Họ đi, không ngoái lại.', 'nhan-2 uy+1'), o('Gài người ở lại theo dõi.', 'Một người trong số họ sẽ gửi tin về.', 'lo+1 tin-1')) },
];

export const tips = [
  { id: 'N1', name: 'Cố Đô Mở', family: 'mo', fruits: ['T1', 'T9'], leaves: ['I1-a', 'I1-d', 'III2-a', 'I2-c'], marks: ['nhan', 'hop'], text: 'Làng thành nơi người ta tìm tới: nhiều giọng nói, nhiều nghề.' },
  { id: 'N2', name: 'Pháo Đài Núi', family: 'kin', fruits: ['T2', 'T4'], leaves: ['III2-d', 'II1-b', 'I2-b'], marks: ['uy'], text: 'Làng khép kín sau tường dày: ít bạn, nhiều lính.' },
  { id: 'N3', name: 'Triều Cống', family: 'cong', fruits: ['T3'], leaves: ['II1-a'], marks: ['lo'], text: 'Làng là chư hầu, mỗi mùa phải nộp. Kẻ đòi phần chưa bao giờ đi hẳn.' },
  { id: 'N4', name: 'Thương Cảng Vỏ Sò', family: 'cho', fruits: ['T5', 'T8'], leaves: ['III1-a', 'II2-a', 'II1-c'], marks: ['tin'], text: 'Làng là nơi bốn bên gặp nhau. Vỏ sò của làng thành tiền chuẩn của vùng.' },
  { id: 'N5', name: 'Đàn Lửa Thiêng', family: 'lua', fruits: ['T6'], leaves: ['III2-c', 'II2-d'], marks: ['tin'], off: true, flowTo: 'N1', text: 'Làng thành nơi hành hương.' },
  { id: 'N6', name: 'Dòng Máu Thù', family: 'thu', fruits: ['T7'], leaves: ['II2-c', 'I2-d', 'II1-d'], marks: ['uy'], text: 'Một mối thù không ai chịu quên. Mùa nào cũng có người tới đòi máu.' },
  { id: 'N7', name: 'Thợ Rèn Đầu Tiên', family: 'nghe', fruits: ['T8'], leaves: ['I1-d', 'III1-c'], marks: [], text: 'Làng bước sang thời mới với tay nghề kim loại sớm hơn cả vùng.' },
  { id: 'N8', name: 'Hai Làng Một Gốc', family: 'goc', fruits: ['T10'], leaves: ['III2-b', 'I1-c'], marks: [], text: 'Làng con bên kia suối nói cùng một tiếng với làng. Bạn hay thù thì chưa ai biết.' },
  { id: 'N9', name: 'Hôn Ước', family: 'hon', fruits: ['T9'], leaves: ['II2-b', 'I2-a'], marks: ['tin', 'hop'], text: 'Một cuộc hôn nhân buộc làng với một làng khác: hiếm, nhưng bền.' },
  { id: 'N0', name: 'Làng Vô Danh', family: 'none', fruits: [], leaves: [], marks: [], default: true, text: 'Làng bước sang thời mới như mọi làng khác. Chưa ai kể chuyện gì về nó.' },
];

// what each stone tip leaves to the medieval age (doc: "Ngọn Đồ đá làm nghiêng cây trung cổ" + "Ngọn đổi cách game vận hành"): first marks, the trunk that comes first, leaf weights, game multipliers
export const legacy = {
  N1: { marks: { luat: 1, hop: 1 }, trunk: 'IV', tilt: { 'IV1-a': 1.4 } },
  N2: { marks: { uy: 1, luat: 1 }, trunk: 'V', tilt: { 'V1-b': 1.4, 'V1-a': 0.7 }, mods: { marketFee: 1.2 } },
  N3: { marks: { cua: 1, uy: -1 }, trunk: 'IV', tilt: { 'IV1-b': 0.8 } },
  N4: { marks: { cua: 2 }, trunk: 'VI', tilt: { 'VI1-c': 1.5 }, mods: { marketFee: 0.8, marketQuota: 1.3 } },
  N6: { marks: { uy: 1, lo: 1 }, trunk: 'V', tilt: { 'V2-a': 1.4 } },
  N7: { marks: { cua: 1, uy: 1 }, trunk: 'VI', tilt: { 'VI1-c': 1.4 }, mods: { craftSpeed: 1.2 } },
  N8: { marks: { hop: 2 }, trunk: 'IV', tilt: { 'IV1-c': 0.7 } },
  N9: { marks: { luat: 1, hop: 1 }, trunk: 'IV', tilt: { 'IV1-a': 1.2 } },
};

// deeds that the game or the leaves leave (not an answer of a scene): their marks
export const deeds = {
  betrayed_gate: 'tin-1', first_victory: 'uy+3', lost_fight: 'lo+2', good_name: 'nhan+1 hop+1', feared_name: 'uy+2', bad_shells: 'tin-1', winter_shared: 'nhan+2 tin+1', wall_saved: 'uy+1 nhan-2', comet: 'tin+2', far_drums: 'uy+1',
};

export const rumors = [
  { mark: 'nhan', at: 4, text: 'Ngoài đường ai cũng kể làng này có bếp lửa lúc nào cũng còn phần cho người lạ.' },
  { mark: 'uy', at: 4, text: 'Mấy người Rìu Đá bảo đừng đụng tới làng này.' },
  { mark: 'lo', at: 4, text: 'Có kẻ đếm kho lương của mình từ bên kia suối.' },
  { mark: 'tin', at: -2, below: true, text: 'Thương lái đồn làng mình nói một đằng làm một nẻo.' },
  { mark: 'hop', at: 5, text: 'Bữa tối giờ không ai phân biệt đâu là người cũ, đâu là người mới.' },
  { mark: 'luat', at: 4, text: 'Người làng khác tới nhờ làng mình phân xử: họ bảo ở đây có lệ rõ ràng.' },
  { mark: 'cua', at: 4, text: 'Thương lái đi đường vòng cũng ghé: họ bảo kho làng này chưa bao giờ trống.' },
  { mark: 'uy', at: 8, text: 'Trẻ con làng bên bị dọa: không ngoan thì lính làng kia tới.' },
  { mark: 'tin', at: 6, text: 'Người ta gửi lời hứa qua làng mình, vì lời đi qua đây thì được giữ.' },
];
