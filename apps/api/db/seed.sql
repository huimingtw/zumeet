-- Taiwan locations seed data
-- Uses slug as primary key for stable, deterministic IDs.
-- Safe to re-run: ON CONFLICT DO NOTHING.

INSERT INTO locations (id, city, district, slug) VALUES
-- 台北市
('taipei-zhongzheng',   '台北市', '中正區', 'taipei-zhongzheng'),
('taipei-datong',       '台北市', '大同區', 'taipei-datong'),
('taipei-zhongshan',    '台北市', '中山區', 'taipei-zhongshan'),
('taipei-songshan',     '台北市', '松山區', 'taipei-songshan'),
('taipei-daan',         '台北市', '大安區', 'taipei-daan'),
('taipei-wanhua',       '台北市', '萬華區', 'taipei-wanhua'),
('taipei-xinyi',        '台北市', '信義區', 'taipei-xinyi'),
('taipei-shilin',       '台北市', '士林區', 'taipei-shilin'),
('taipei-beitou',       '台北市', '北投區', 'taipei-beitou'),
('taipei-neihu',        '台北市', '內湖區', 'taipei-neihu'),
('taipei-nangang',      '台北市', '南港區', 'taipei-nangang'),
('taipei-wenshan',      '台北市', '文山區', 'taipei-wenshan'),

-- 新北市
('newtaipei-banqiao',   '新北市', '板橋區', 'newtaipei-banqiao'),
('newtaipei-xindian',   '新北市', '新店區', 'newtaipei-xindian'),
('newtaipei-zhonghe',   '新北市', '中和區', 'newtaipei-zhonghe'),
('newtaipei-yonghe',    '新北市', '永和區', 'newtaipei-yonghe'),
('newtaipei-xinzhuang', '新北市', '新莊區', 'newtaipei-xinzhuang'),
('newtaipei-sanchong',  '新北市', '三重區', 'newtaipei-sanchong'),
('newtaipei-luzhou',    '新北市', '蘆洲區', 'newtaipei-luzhou'),
('newtaipei-tucheng',   '新北市', '土城區', 'newtaipei-tucheng'),
('newtaipei-shulin',    '新北市', '樹林區', 'newtaipei-shulin'),
('newtaipei-sanxia',    '新北市', '三峽區', 'newtaipei-sanxia'),
('newtaipei-xizhi',     '新北市', '汐止區', 'newtaipei-xizhi'),
('newtaipei-tamsui',    '新北市', '淡水區', 'newtaipei-tamsui'),
('newtaipei-wugu',      '新北市', '五股區', 'newtaipei-wugu'),
('newtaipei-linkou',    '新北市', '林口區', 'newtaipei-linkou'),

-- 桃園市
('taoyuan-taoyuan',     '桃園市', '桃園區', 'taoyuan-taoyuan'),
('taoyuan-zhongli',     '桃園市', '中壢區', 'taoyuan-zhongli'),
('taoyuan-pingzhen',    '桃園市', '平鎮區', 'taoyuan-pingzhen'),
('taoyuan-bade',        '桃園市', '八德區', 'taoyuan-bade'),
('taoyuan-luzhu',       '桃園市', '蘆竹區', 'taoyuan-luzhu'),
('taoyuan-guishan',     '桃園市', '龜山區', 'taoyuan-guishan'),
('taoyuan-yangmei',     '桃園市', '楊梅區', 'taoyuan-yangmei'),

-- 新竹市
('hsinchu-east',        '新竹市', '東區', 'hsinchu-east'),
('hsinchu-north',       '新竹市', '北區', 'hsinchu-north'),
('hsinchu-xiangshan',   '新竹市', '香山區', 'hsinchu-xiangshan'),

-- 新竹縣
('hsinchuCounty-zhubei','新竹縣', '竹北市', 'hsinchucounty-zhubei'),
('hsinchuCounty-zhudong','新竹縣','竹東鎮', 'hsinchucounty-zhudong'),

-- 台中市
('taichung-central',    '台中市', '中區',   'taichung-central'),
('taichung-east',       '台中市', '東區',   'taichung-east'),
('taichung-south',      '台中市', '南區',   'taichung-south'),
('taichung-west',       '台中市', '西區',   'taichung-west'),
('taichung-north',      '台中市', '北區',   'taichung-north'),
('taichung-xitun',      '台中市', '西屯區', 'taichung-xitun'),
('taichung-nantun',     '台中市', '南屯區', 'taichung-nantun'),
('taichung-beitun',     '台中市', '北屯區', 'taichung-beitun'),
('taichung-fengyuan',   '台中市', '豐原區', 'taichung-fengyuan'),
('taichung-dali',       '台中市', '大里區', 'taichung-dali'),
('taichung-taiping',    '台中市', '太平區', 'taichung-taiping'),

-- 台南市
('tainan-central',      '台南市', '中西區', 'tainan-central'),
('tainan-east',         '台南市', '東區',   'tainan-east'),
('tainan-south',        '台南市', '南區',   'tainan-south'),
('tainan-north',        '台南市', '北區',   'tainan-north'),
('tainan-anping',       '台南市', '安平區', 'tainan-anping'),
('tainan-annan',        '台南市', '安南區', 'tainan-annan'),
('tainan-yongkang',     '台南市', '永康區', 'tainan-yongkang'),
('tainan-rende',        '台南市', '仁德區', 'tainan-rende'),

-- 高雄市
('kaohsiung-lingya',    '高雄市', '苓雅區', 'kaohsiung-lingya'),
('kaohsiung-xinxing',   '高雄市', '新興區', 'kaohsiung-xinxing'),
('kaohsiung-qianjin',   '高雄市', '前金區', 'kaohsiung-qianjin'),
('kaohsiung-yancheng',  '高雄市', '鹽埕區', 'kaohsiung-yancheng'),
('kaohsiung-gushan',    '高雄市', '鼓山區', 'kaohsiung-gushan'),
('kaohsiung-zuoying',   '高雄市', '左營區', 'kaohsiung-zuoying'),
('kaohsiung-nanzi',     '高雄市', '楠梓區', 'kaohsiung-nanzi'),
('kaohsiung-sanmin',    '高雄市', '三民區', 'kaohsiung-sanmin'),
('kaohsiung-qianzhen',  '高雄市', '前鎮區', 'kaohsiung-qianzhen'),
('kaohsiung-xiaogang',  '高雄市', '小港區', 'kaohsiung-xiaogang'),
('kaohsiung-fengshan',  '高雄市', '鳳山區', 'kaohsiung-fengshan'),
('kaohsiung-renwu',     '高雄市', '仁武區', 'kaohsiung-renwu')

ON CONFLICT (id) DO NOTHING;
