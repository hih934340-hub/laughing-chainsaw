const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let sessionData = {};

// Dữ liệu mẫu
const SAMPLE_DATA = {
    'C01': 'BPPBPPPBPPPBPBBBTPBBBBBPBPBPPPBBBBBBPBPBBPPBBPP',
    'C02': 'BBBBBBBBPBPPTBBBPBPPPPPPBPPPBPBPPPBPPBP',
    '1': 'BBBBBBBBPBPPTBBBPBPPPPPPBPPPBPBPPPBPPBP',
    '2': 'BPPBPPPBPPPBPBBBTPBBBBBPBPBPPPBBBBBBPBPBBPPBBPP'
};

// ============================================================
// LỚP PHÂN TÍCH CẦU SIÊU VIP
// ============================================================

class SieuVipAnalyzer {
    constructor(tableId) {
        this.tableId = tableId;
        this.history = [];
        this.rawResult = '';
        this.cauHistory = [];
        this.streakHistory = [];
        this.patterns = {};
        this.matrix = { B: { B: 0, P: 0 }, P: { B: 0, P: 0 } };
        this.positions = { B: [], P: [], T: [] };
        this.gaps = { B: [], P: [], T: [] };
        this.frequency = { B: 0, P: 0, T: 0 };
        this.entropy = 0;
        this.trends = [];
    }

    // ============================================================
    // 1. LẤY DỮ LIỆU
    // ============================================================
    
    async fetchData() {
        try {
            const url = `https://symmetrical-carnival-d111.onrender.com/api/baccarat/${this.tableId}`;
            const response = await axios.get(url, { timeout: 5000 });
            
            if (response.data && response.data.success) {
                this.rawResult = response.data.data.result;
                this.history = this.rawResult.split('');
                this.buildAll();
                return true;
            }
            return false;
        } catch (error) {
            const sampleData = SAMPLE_DATA[this.tableId] || SAMPLE_DATA['C01'];
            if (sampleData) {
                this.rawResult = sampleData;
                this.history = sampleData.split('');
                this.buildAll();
                return true;
            }
            return false;
        }
    }

    // ============================================================
    // 2. XÂY DỰNG TẤT CẢ DỮ LIỆU PHÂN TÍCH
    // ============================================================
    
    buildAll() {
        this.buildCauHistory();
        this.buildMatrix();
        this.buildPositions();
        this.buildGaps();
        this.buildFrequency();
        this.buildEntropy();
        this.buildTrends();
        this.buildPatterns();
    }

    // 2.1 Xây dựng lịch sử cầu
    buildCauHistory() {
        this.cauHistory = [];
        this.streakHistory = [];
        
        if (this.history.length === 0) return;
        
        let currentStreak = 1;
        let currentChar = this.history[0];
        
        for (let i = 1; i < this.history.length; i++) {
            if (this.history[i] === currentChar) {
                currentStreak++;
            } else {
                this.cauHistory.push({
                    char: currentChar,
                    length: currentStreak,
                    start: i - currentStreak,
                    end: i - 1
                });
                this.streakHistory.push(currentStreak);
                currentChar = this.history[i];
                currentStreak = 1;
            }
        }
        this.cauHistory.push({
            char: currentChar,
            length: currentStreak,
            start: this.history.length - currentStreak,
            end: this.history.length - 1
        });
        this.streakHistory.push(currentStreak);
    }

    // 2.2 Xây dựng ma trận chuyển đổi
    buildMatrix() {
        this.matrix = { B: { B: 0, P: 0 }, P: { B: 0, P: 0 } };
        for (let i = 0; i < this.history.length - 1; i++) {
            const current = this.history[i];
            const next = this.history[i + 1];
            if (this.matrix[current] && this.matrix[current][next] !== undefined) {
                this.matrix[current][next]++;
            }
        }
    }

    // 2.3 Xây dựng vị trí xuất hiện
    buildPositions() {
        this.positions = { B: [], P: [], T: [] };
        this.history.forEach((char, index) => {
            if (this.positions[char]) {
                this.positions[char].push(index);
            }
        });
    }

    // 2.4 Xây dựng khoảng cách
    buildGaps() {
        this.gaps = { B: [], P: [], T: [] };
        for (let char of ['B', 'P', 'T']) {
            const positions = this.positions[char] || [];
            for (let i = 1; i < positions.length; i++) {
                this.gaps[char].push(positions[i] - positions[i-1]);
            }
        }
    }

    // 2.5 Xây dựng tần suất
    buildFrequency() {
        this.frequency = { B: 0, P: 0, T: 0 };
        this.history.forEach(char => {
            if (this.frequency[char] !== undefined) {
                this.frequency[char]++;
            }
        });
    }

    // 2.6 Xây dựng Entropy
    buildEntropy() {
        const total = this.history.length;
        if (total === 0) {
            this.entropy = 0;
            return;
        }
        const pB = this.frequency.B / total;
        const pP = this.frequency.P / total;
        const pT = this.frequency.T / total;
        
        let entropy = 0;
        if (pB > 0) entropy -= pB * Math.log2(pB);
        if (pP > 0) entropy -= pP * Math.log2(pP);
        if (pT > 0) entropy -= pT * Math.log2(pT);
        
        this.entropy = Math.min(entropy, 1);
    }

    // 2.7 Xây dựng xu hướng
    buildTrends() {
        this.trends = [];
        let bCount = 0, pCount = 0;
        for (let i = 0; i < this.history.length; i++) {
            if (this.history[i] === 'B') bCount++;
            else if (this.history[i] === 'P') pCount++;
            if ((i + 1) % 5 === 0 || i === this.history.length - 1) {
                this.trends.push({
                    position: i + 1,
                    B: bCount,
                    P: pCount,
                    diff: bCount - pCount
                });
                bCount = 0;
                pCount = 0;
            }
        }
    }

    // 2.8 Xây dựng mô hình
    buildPatterns() {
        this.patterns = {};
        for (let size = 2; size <= 7; size++) {
            this.patterns[size] = {};
            for (let i = 0; i <= this.history.length - size; i++) {
                const pattern = this.history.slice(i, i + size).join('');
                this.patterns[size][pattern] = (this.patterns[size][pattern] || 0) + 1;
            }
        }
    }

    // ============================================================
    // 3. NHẬN DIỆN CÁC LOẠI CẦU (10 LOẠI)
    // ============================================================

    detectAllCau() {
        const results = {
            cauBet: this.detectCauBet(),
            cauDao: this.detectCauDao(),
            cauNhip: this.detectCauNhip(),
            cauOneOneTwoTwo: this.detectCauOneOneTwoTwo(),
            cauTwoTwoOneOne: this.detectCauTwoTwoOneOne(),
            cauThreeThree: this.detectCauThreeThree(),
            cauTwoThreeTwo: this.detectCauTwoThreeTwo(),
            cauThreeTwoThree: this.detectCauThreeTwoThree(),
            cauXenKeCheo: this.detectCauXenKeCheo(),
            cauHonHop: this.detectCauHonHop()
        };

        // Chọn loại cầu có độ tin cậy cao nhất
        let best = null;
        let bestScore = 0;
        
        for (let [key, value] of Object.entries(results)) {
            if (value && value.confidence > bestScore) {
                bestScore = value.confidence;
                best = {
                    type: key,
                    ...value
                };
            }
        }

        return best || results.cauHonHop;
    }

    // 3.1 CẦU BỆT
    detectCauBet() {
        if (this.cauHistory.length < 2) {
            return { type: 'Cầu bệt', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last1 = this.cauHistory[this.cauHistory.length - 1];
        const last2 = this.cauHistory[this.cauHistory.length - 2];
        const last3 = this.cauHistory[this.cauHistory.length - 3];

        // Kiểm tra bệt
        if (last1.char === last2.char) {
            const totalLen = last1.length + (last2 ? last2.length : 0);
            const avgStreak = this.streakHistory.reduce((a, b) => a + b, 0) / this.streakHistory.length;
            
            let confidence = 0;
            let description = '';
            let trend = '';
            let strength = 0;

            if (totalLen >= 8) {
                confidence = 90;
                description = `Cầu bệt siêu dài ${last1.char} (${totalLen} ván), sắp đảo chiều`;
                trend = 'Sắp đảo';
                strength = 95;
            } else if (totalLen >= 5) {
                confidence = 80;
                description = `Cầu bệt dài ${last1.char} (${totalLen} ván), có thể tiếp tục hoặc đảo`;
                trend = 'Đang mạnh';
                strength = 85;
            } else if (totalLen >= 3) {
                confidence = 65;
                description = `Cầu bệt ${last1.char} (${totalLen} ván), đang hình thành`;
                trend = 'Đang phát triển';
                strength = 70;
            } else {
                confidence = 50;
                description = `Cầu bệt nhỏ ${last1.char}`;
                trend = 'Còn yếu';
                strength = 55;
            }

            // Điều chỉnh nếu vượt trung bình
            if (totalLen > avgStreak * 1.5) {
                confidence = Math.min(95, confidence + 10);
                description += ' - Vượt trung bình, cẩn thận đảo';
            }

            // Kiểm tra bệt 3-4 lần
            if (last3 && last3.char === last1.char) {
                confidence = Math.min(95, confidence + 5);
                description += ' - Bệt kéo dài qua 3 cầu';
            }

            return {
                type: `Cầu bệt ${last1.char}`,
                confidence,
                description,
                trend,
                strength,
                currentStreak: totalLen,
                lastChar: last1.char,
                pattern: last1.char.repeat(totalLen)
            };
        }

        return null;
    }

    // 3.2 CẦU ĐẢO
    detectCauDao() {
        if (this.cauHistory.length < 4) {
            return { type: 'Cầu đảo', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last4 = this.cauHistory.slice(-4);
        const last5 = this.cauHistory.slice(-5);

        // Kiểm tra xen kẽ
        let isAlternating = true;
        let pattern = [];
        
        for (let i = 0; i < last4.length - 1; i++) {
            if (last4[i].char === last4[i + 1].char) {
                isAlternating = false;
                break;
            }
            pattern.push(last4[i].char);
        }

        if (isAlternating && pattern.length >= 3) {
            const totalLen = last4.reduce((sum, c) => sum + c.length, 0);
            const avgLen = totalLen / last4.length;

            let confidence = 0;
            let description = '';
            let trend = '';
            let strength = 0;

            if (last4.length >= 5) {
                confidence = 85;
                description = `Cầu đảo hoàn hảo ${pattern.join('')}, độ dài trung bình ${Math.round(avgLen)}`;
                trend = 'Tiếp tục đảo';
                strength = 88;
            } else if (last4.length >= 4) {
                confidence = 75;
                description = `Cầu đảo mạnh ${pattern.join('')}`;
                trend = 'Đang đảo mạnh';
                strength = 78;
            } else {
                confidence = 60;
                description = `Cầu đảo vừa ${pattern.join('')}`;
                trend = 'Bắt đầu đảo';
                strength = 65;
            }

            // Kiểm tra tỉ lệ đảo trong lịch sử
            const daoCount = this.cauHistory.filter((c, i) => 
                i < this.cauHistory.length - 1 && c.char !== this.cauHistory[i+1].char
            ).length;
            const tiLeDao = daoCount / (this.cauHistory.length - 1);
            
            if (tiLeDao > 0.7) {
                confidence = Math.min(95, confidence + 10);
                description += ' - Lịch sử có xu hướng đảo mạnh';
            }

            return {
                type: `Cầu đảo ${pattern.join('')}`,
                confidence,
                description,
                trend,
                strength,
                pattern: pattern,
                avgLength: Math.round(avgLen * 10) / 10,
                totalLength: totalLen
            };
        }

        return null;
    }

    // 3.3 CẦU NHỊP
    detectCauNhip() {
        if (this.cauHistory.length < 4) {
            return { type: 'Cầu nhịp', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last4 = this.cauHistory.slice(-4);
        const lengths = last4.map(c => c.length);
        const chars = last4.map(c => c.char);

        let isNhip = false;
        let nhipType = '';
        let confidence = 0;
        let description = '';
        let trend = '';
        let strength = 0;

        // Kiểm tra 2-2-2
        if (lengths[0] === lengths[1] && lengths[1] === lengths[2] && lengths[0] >= 2) {
            if (chars[0] !== chars[1] && chars[1] !== chars[2]) {
                isNhip = true;
                nhipType = `${lengths[0]}-${lengths[0]}-${lengths[0]}`;
                confidence = 80;
                description = `Cầu nhịp ${nhipType} đều, rất ổn định`;
                trend = 'Tiếp tục nhịp';
                strength = 85;
            }
        }

        // Kiểm tra 3-3-2
        if (lengths[0] === lengths[1] && lengths[1] === 3 && lengths[2] === 2) {
            isNhip = true;
            nhipType = '3-3-2';
            confidence = 75;
            description = 'Cầu nhịp 3-3-2, đang giảm dần';
            trend = 'Sắp về 2';
            strength = 78;
        }

        // Kiểm tra 2-3-2
        if (lengths[0] === 2 && lengths[1] === 3 && lengths[2] === 2) {
            isNhip = true;
            nhipType = '2-3-2';
            confidence = 82;
            description = 'Cầu nhịp 2-3-2 đặc biệt, đỉnh 3';
            trend = 'Sắp về 2';
            strength = 85;
        }

        // Kiểm tra 3-2-3
        if (lengths[0] === 3 && lengths[1] === 2 && lengths[2] === 3) {
            isNhip = true;
            nhipType = '3-2-3';
            confidence = 82;
            description = 'Cầu nhịp 3-2-3 đặc biệt, đáy 2';
            trend = 'Sắp về 3';
            strength = 85;
        }

        // Kiểm tra 2-2-3
        if (lengths[0] === 2 && lengths[1] === 2 && lengths[2] === 3) {
            isNhip = true;
            nhipType = '2-2-3';
            confidence = 70;
            description = 'Cầu nhịp 2-2-3, đang tăng';
            trend = 'Tiếp tục tăng';
            strength = 72;
        }

        // Kiểm tra 3-2-2
        if (lengths[0] === 3 && lengths[1] === 2 && lengths[2] === 2) {
            isNhip = true;
            nhipType = '3-2-2';
            confidence = 70;
            description = 'Cầu nhịp 3-2-2, đang giảm';
            trend = 'Tiếp tục giảm';
            strength = 72;
        }

        if (isNhip) {
            return {
                type: `Cầu nhịp ${nhipType}`,
                confidence,
                description,
                trend,
                strength,
                pattern: chars.map((c, i) => c.repeat(lengths[i])),
                lengths: lengths
            };
        }

        return null;
    }

    // 3.4 CẦU 1-1-2-2
    detectCauOneOneTwoTwo() {
        if (this.cauHistory.length < 4) {
            return { type: 'Cầu 1-1-2-2', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last4 = this.cauHistory.slice(-4);
        const lengths = last4.map(c => c.length);
        const chars = last4.map(c => c.char);

        if (lengths[0] === 1 && lengths[1] === 1 && lengths[2] === 2 && lengths[3] === 2) {
            let confidence = 85;
            let description = 'Cầu 1-1-2-2 hoàn hảo, xu hướng tăng dần';
            let trend = 'Tiếp tục tăng';
            let strength = 88;

            // Điều chỉnh dựa trên lịch sử
            if (this.cauHistory.length > 10) {
                const patternCount = this.patterns[4] ? (this.patterns[4]['1122'] || 0) : 0;
                if (patternCount > 1) {
                    confidence = Math.min(95, confidence + 5);
                    description += ` - Đã xuất hiện ${patternCount} lần trong lịch sử`;
                }
            }

            return {
                type: 'Cầu 1-1-2-2',
                confidence,
                description,
                trend,
                strength,
                pattern: chars.map((c, i) => c.repeat(lengths[i])),
                lengths: lengths
            };
        }

        return null;
    }

    // 3.5 CẦU 2-2-1-1
    detectCauTwoTwoOneOne() {
        if (this.cauHistory.length < 4) {
            return { type: 'Cầu 2-2-1-1', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last4 = this.cauHistory.slice(-4);
        const lengths = last4.map(c => c.length);
        const chars = last4.map(c => c.char);

        if (lengths[0] === 2 && lengths[1] === 2 && lengths[2] === 1 && lengths[3] === 1) {
            let confidence = 85;
            let description = 'Cầu 2-2-1-1 hoàn hảo, xu hướng giảm dần';
            let trend = 'Tiếp tục giảm';
            let strength = 88;

            if (this.cauHistory.length > 10) {
                const patternCount = this.patterns[4] ? (this.patterns[4]['2211'] || 0) : 0;
                if (patternCount > 1) {
                    confidence = Math.min(95, confidence + 5);
                    description += ` - Đã xuất hiện ${patternCount} lần trong lịch sử`;
                }
            }

            return {
                type: 'Cầu 2-2-1-1',
                confidence,
                description,
                trend,
                strength,
                pattern: chars.map((c, i) => c.repeat(lengths[i])),
                lengths: lengths
            };
        }

        return null;
    }

    // 3.6 CẦU 3-3
    detectCauThreeThree() {
        if (this.cauHistory.length < 2) {
            return { type: 'Cầu 3-3', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last2 = this.cauHistory.slice(-2);
        
        if (last2[0].length === 3 && last2[1].length === 3 && last2[0].char !== last2[1].char) {
            let confidence = 90;
            let description = 'Cầu 3-3 hoàn hảo, cực kỳ cân bằng';
            let trend = 'Có thể tiếp tục 3-3';
            let strength = 92;

            // Kiểm tra lịch sử
            const threeThreeCount = this.cauHistory.filter((c, i) => 
                i < this.cauHistory.length - 1 && 
                c.length === 3 && 
                this.cauHistory[i+1].length === 3 &&
                c.char !== this.cauHistory[i+1].char
            ).length;

            if (threeThreeCount > 1) {
                confidence = Math.min(95, confidence + 5);
                description += ` - Đã xuất hiện ${threeThreeCount} lần, rất tin cậy`;
            }

            return {
                type: 'Cầu 3-3',
                confidence,
                description,
                trend,
                strength,
                pattern: [last2[0].char.repeat(3), last2[1].char.repeat(3)],
                lengths: [3, 3]
            };
        }

        return null;
    }

    // 3.7 CẦU 2-3-2
    detectCauTwoThreeTwo() {
        if (this.cauHistory.length < 3) {
            return { type: 'Cầu 2-3-2', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last3 = this.cauHistory.slice(-3);
        
        if (last3[0].length === 2 && last3[1].length === 3 && last3[2].length === 2) {
            let confidence = 85;
            let description = 'Cầu 2-3-2 đặc biệt, đang ở đỉnh 3';
            let trend = 'Sắp về 2';
            let strength = 87;

            // Kiểm tra lịch sử
            if (this.cauHistory.length > 10) {
                const patternCount = this.patterns[3] ? (this.patterns[3]['232'] || 0) : 0;
                if (patternCount > 1) {
                    confidence = Math.min(95, confidence + 5);
                    description += ` - Đã xuất hiện ${patternCount} lần`;
                }
            }

            return {
                type: 'Cầu 2-3-2',
                confidence,
                description,
                trend,
                strength,
                pattern: last3.map(c => c.char.repeat(c.length)),
                lengths: [2, 3, 2]
            };
        }

        return null;
    }

    // 3.8 CẦU 3-2-3
    detectCauThreeTwoThree() {
        if (this.cauHistory.length < 3) {
            return { type: 'Cầu 3-2-3', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last3 = this.cauHistory.slice(-3);
        
        if (last3[0].length === 3 && last3[1].length === 2 && last3[2].length === 3) {
            let confidence = 85;
            let description = 'Cầu 3-2-3 đặc biệt, đang ở đáy 2';
            let trend = 'Sắp về 3';
            let strength = 87;

            if (this.cauHistory.length > 10) {
                const patternCount = this.patterns[3] ? (this.patterns[3]['323'] || 0) : 0;
                if (patternCount > 1) {
                    confidence = Math.min(95, confidence + 5);
                    description += ` - Đã xuất hiện ${patternCount} lần`;
                }
            }

            return {
                type: 'Cầu 3-2-3',
                confidence,
                description,
                trend,
                strength,
                pattern: last3.map(c => c.char.repeat(c.length)),
                lengths: [3, 2, 3]
            };
        }

        return null;
    }

    // 3.9 CẦU XEN KẼ CHÉO
    detectCauXenKeCheo() {
        if (this.cauHistory.length < 3) {
            return { type: 'Cầu xen kẽ chéo', confidence: 0, description: 'Chưa đủ dữ liệu' };
        }

        const last3 = this.cauHistory.slice(-3);
        
        // B-P-B hoặc P-B-P
        if (last3[0].char !== last3[1].char && 
            last3[1].char !== last3[2].char && 
            last3[0].char === last3[2].char) {
            
            const avgLen = (last3[0].length + last3[2].length) / 2;
            let confidence = 0;
            let description = '';
            let trend = '';
            let strength = 0;

            if (avgLen >= 3) {
                confidence = 88;
                description = 'Cầu xen kẽ chéo mạnh, đang mở rộng';
                trend = 'Tiếp tục mở rộng';
                strength = 90;
            } else if (avgLen >= 2) {
                confidence = 75;
                description = 'Cầu xen kẽ chéo vừa';
                trend = 'Đang ổn định';
                strength = 78;
            } else {
                confidence = 60;
                description = 'Cầu xen kẽ chéo yếu';
                trend = 'Đang hình thành';
                strength = 65;
            }

            // Kiểm tra lịch sử
            if (this.cauHistory.length > 10) {
                const crossCount = this.cauHistory.filter((c, i) => 
                    i < this.cauHistory.length - 2 && 
                    c.char !== this.cauHistory[i+1].char &&
                    this.cauHistory[i+1].char !== this.cauHistory[i+2].char &&
                    c.char === this.cauHistory[i+2].char
                ).length;
                
                if (crossCount > 2) {
                    confidence = Math.min(95, confidence + 5);
                    description += ' - Xu hướng xen kẽ mạnh';
                }
            }

            return {
                type: 'Cầu xen kẽ chéo',
                confidence,
                description,
                trend,
                strength,
                pattern: last3.map(c => c.char.repeat(c.length)),
                avgLength: Math.round(avgLen * 10) / 10
            };
        }

        return null;
    }

    // 3.10 CẦU HỖN HỢP
    detectCauHonHop() {
        const total = this.history.length;
        if (total === 0) {
            return {
                type: 'Cầu hỗn hợp',
                confidence: 0,
                description: 'Chưa có dữ liệu',
                trend: 'Chưa xác định',
                strength: 0
            };
        }

        const bCount = this.frequency.B || 0;
        const pCount = this.frequency.P || 0;
        const tCount = this.frequency.T || 0;
        
        const ratioB = bCount / total;
        const ratioP = pCount / total;
        
        let confidence = 0;
        let description = '';
        let trend = '';
        let strength = 0;

        // Phân tích xu hướng tổng thể
        const diff = Math.abs(ratioB - ratioP);
        
        if (diff < 0.05) {
            confidence = 50;
            description = 'Cầu cực kỳ cân bằng, B và P ngang nhau';
            trend = 'Cân bằng tuyệt đối';
            strength = 55;
        } else if (diff < 0.1) {
            confidence = 55;
            description = 'Cầu cân bằng, B và P gần như ngang nhau';
            trend = 'Cân bằng';
            strength = 60;
        } else if (diff < 0.15) {
            confidence = 60;
            if (ratioB > ratioP) {
                description = `B hơn P ${Math.round(diff * 100)}%, chênh lệch nhỏ`;
                trend = 'Hơi nghiêng B';
            } else {
                description = `P hơn B ${Math.round(diff * 100)}%, chênh lệch nhỏ`;
                trend = 'Hơi nghiêng P';
            }
            strength = 65;
        } else if (diff < 0.25) {
            confidence = 65;
            if (ratioB > ratioP) {
                description = `B áp đảo P ${Math.round(diff * 100)}%`;
                trend = 'Nghiêng B';
            } else {
                description = `P áp đảo B ${Math.round(diff * 100)}%`;
                trend = 'Nghiêng P';
            }
            strength = 70;
        } else {
            confidence = 70;
            if (ratioB > ratioP) {
                description = `B cực kỳ áp đảo P ${Math.round(diff * 100)}%`;
                trend = 'B mạnh';
            } else {
                description = `P cực kỳ áp đảo B ${Math.round(diff * 100)}%`;
                trend = 'P mạnh';
            }
            strength = 75;
        }

        // Điều chỉnh dựa trên entropy
        if (this.entropy < 0.5) {
            confidence = Math.min(80, confidence + 10);
            description += ' - Dữ liệu ít hỗn loạn, dễ dự đoán';
        } else if (this.entropy > 0.8) {
            confidence = Math.max(40, confidence - 10);
            description += ' - Dữ liệu hỗn loạn, khó dự đoán';
        }

        // Phân tích 20 ván gần nhất
        const last20 = this.history.slice(-20);
        const bLast20 = last20.filter(c => c === 'B').length;
        const pLast20 = last20.filter(c => c === 'P').length;
        
        if (Math.abs(bLast20 - pLast20) <= 2) {
            description += ', 20 ván gần đây rất cân bằng';
        } else if (bLast20 > pLast20 + 4) {
            description += ', 20 ván gần đây nghiêng B mạnh';
            trend += ' (gần đây)';
        } else if (pLast20 > bLast20 + 4) {
            description += ', 20 ván gần đây nghiêng P mạnh';
            trend += ' (gần đây)';
        }

        // Lấy mô hình top
        const topPatterns = this.getTopPatterns();

        return {
            type: 'Cầu hỗn hợp',
            confidence: Math.round(confidence),
            description,
            trend,
            strength: Math.round(strength),
            ratioB: Math.round(ratioB * 1000) / 10,
            ratioP: Math.round(ratioP * 1000) / 10,
            ratioT: Math.round((tCount / total) * 1000) / 10,
            entropy: Math.round(this.entropy * 1000) / 10,
            topPatterns: topPatterns,
            total: total,
            bCount: bCount,
            pCount: pCount,
            tCount: tCount
        };
    }

    // ============================================================
    // 4. PHÂN TÍCH MÔ HÌNH TOP
    // ============================================================
    
    getTopPatterns() {
        const result = [];
        for (let size of [2, 3, 4]) {
            const patterns = this.patterns[size] || {};
            const sorted = Object.entries(patterns)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            result.push({
                size: size,
                patterns: sorted.map(([pattern, count]) => ({ pattern, count }))
            });
        }
        return result;
    }

    // ============================================================
    // 5. DỰ ĐOÁN THÔNG MINH
    // ============================================================
    
    predict() {
        const cauInfo = this.detectAllCau();
        const currentStreak = this.getCurrentStreak();
        const lastChar = this.history[this.history.length - 1] || 'B';
        const avgStreak = this.streakHistory.reduce((a, b) => a + b, 0) / this.streakHistory.length;

        let probB = 0.5;
        let probP = 0.5;

        // ===== DỰ ĐOÁN THEO TỪNG LOẠI CẦU =====
        
        // Cầu bệt
        if (cauInfo.type && cauInfo.type.includes('bệt')) {
            if (currentStreak >= 6) {
                // Bệt siêu dài, khả năng đảo rất cao
                if (lastChar === 'B') {
                    probP = 0.75 + Math.min(0.15, (currentStreak - 6) * 0.02);
                    probB = 1 - probP;
                } else {
                    probB = 0.75 + Math.min(0.15, (currentStreak - 6) * 0.02);
                    probP = 1 - probB;
                }
            } else if (currentStreak >= 4) {
                // Bệt dài, khả năng đảo
                if (lastChar === 'B') {
                    probP = 0.65 + (currentStreak - 4) * 0.03;
                    probB = 1 - probP;
                } else {
                    probB = 0.65 + (currentStreak - 4) * 0.03;
                    probP = 1 - probB;
                }
            } else if (currentStreak >= 2) {
                // Bệt vừa, khả năng tiếp tục
                if (lastChar === 'B') {
                    probB = 0.62;
                    probP = 0.38;
                } else {
                    probP = 0.62;
                    probB = 0.38;
                }
            } else {
                // Bệt mới
                if (lastChar === 'B') {
                    probB = 0.58;
                    probP = 0.42;
                } else {
                    probP = 0.58;
                    probB = 0.42;
                }
            }
        }

        // Cầu đảo
        else if (cauInfo.type && cauInfo.type.includes('đảo')) {
            const nextChar = lastChar === 'B' ? 'P' : 'B';
            if (nextChar === 'B') {
                probB = 0.65 + cauInfo.confidence / 100 * 0.10;
                probP = 1 - probB;
            } else {
                probP = 0.65 + cauInfo.confidence / 100 * 0.10;
                probB = 1 - probP;
            }
        }

        // Cầu nhịp
        else if (cauInfo.type && cauInfo.type.includes('nhịp')) {
            const lengths = cauInfo.lengths || [];
            if (lengths.length >= 2) {
                const lastLen = lengths[lengths.length - 1];
                const prevLen = lengths[lengths.length - 2];
                
                // Dự đoán độ dài tiếp theo
                let nextLen = 0;
                if (lastLen === prevLen) {
                    nextLen = lastLen;
                } else if (lastLen > prevLen) {
                    nextLen = lastLen - 1;
                } else {
                    nextLen = lastLen + 1;
                }
                
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextLen >= 3) {
                    if (nextChar === 'B') probB = 0.68;
                    else probP = 0.68;
                } else if (nextLen === 2) {
                    if (nextChar === 'B') probB = 0.60;
                    else probP = 0.60;
                } else {
                    if (nextChar === 'B') probB = 0.55;
                    else probP = 0.55;
                }
            }
        }

        // Cầu 1-1-2-2
        else if (cauInfo.type && cauInfo.type.includes('1-1-2-2')) {
            const currentLen = this.cauHistory[this.cauHistory.length - 1].length;
            if (currentLen === 2) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.70;
                else probP = 0.70;
            } else {
                if (lastChar === 'B') probB = 0.60;
                else probP = 0.60;
            }
        }

        // Cầu 2-2-1-1
        else if (cauInfo.type && cauInfo.type.includes('2-2-1-1')) {
            const currentLen = this.cauHistory[this.cauHistory.length - 1].length;
            if (currentLen === 1) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.70;
                else probP = 0.70;
            } else {
                if (lastChar === 'B') probB = 0.60;
                else probP = 0.60;
            }
        }

        // Cầu 3-3
        else if (cauInfo.type && cauInfo.type.includes('3-3')) {
            if (currentStreak === 3) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.72;
                else probP = 0.72;
            } else if (currentStreak === 2) {
                if (lastChar === 'B') probB = 0.62;
                else probP = 0.62;
            } else {
                if (lastChar === 'B') probB = 0.58;
                else probP = 0.58;
            }
        }

        // Cầu 2-3-2
        else if (cauInfo.type && cauInfo.type.includes('2-3-2')) {
            const currentLen = this.cauHistory[this.cauHistory.length - 1].length;
            if (currentLen === 3) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.72;
                else probP = 0.72;
            } else if (currentLen === 2) {
                if (lastChar === 'B') probB = 0.62;
                else probP = 0.62;
            } else {
                if (lastChar === 'B') probB = 0.55;
                else probP = 0.55;
            }
        }

        // Cầu 3-2-3
        else if (cauInfo.type && cauInfo.type.includes('3-2-3')) {
            const currentLen = this.cauHistory[this.cauHistory.length - 1].length;
            if (currentLen === 2) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.72;
                else probP = 0.72;
            } else if (currentLen === 3) {
                if (lastChar === 'B') probB = 0.62;
                else probP = 0.62;
            } else {
                if (lastChar === 'B') probB = 0.55;
                else probP = 0.55;
            }
        }

        // Cầu xen kẽ chéo
        else if (cauInfo.type && cauInfo.type.includes('xen kẽ')) {
            const nextChar = lastChar === 'B' ? 'P' : 'B';
            if (nextChar === 'B') {
                probB = 0.70 + cauInfo.confidence / 100 * 0.10;
                probP = 1 - probB;
            } else {
                probP = 0.70 + cauInfo.confidence / 100 * 0.10;
                probB = 1 - probP;
            }
        }

        // Cầu hỗn hợp
        else {
            // Dùng thống kê tổng thể
            const ratio = this.frequency.B / this.history.length;
            if (ratio > 0.55) {
                probB = 0.55 + (ratio - 0.55) * 0.6;
                probP = 1 - probB;
            } else if (ratio < 0.45) {
                probP = 0.55 + (0.45 - ratio) * 0.6;
                probB = 1 - probP;
            } else {
                probB = 0.52;
                probP = 0.48;
            }

            // Điều chỉnh theo xu hướng gần đây
            const last20 = this.history.slice(-20);
            const bLast20 = last20.filter(c => c === 'B').length;
            if (bLast20 > 12) {
                probB = Math.min(0.75, probB + 0.05);
                probP = 1 - probB;
            } else if (bLast20 < 8) {
                probP = Math.min(0.75, probP + 0.05);
                probB = 1 - probP;
            }
        }

        // ===== ĐIỀU CHỈNH THEO ĐỘ TIN CẬY =====
        const confidenceFactor = (cauInfo.confidence || 50) / 100;
        if (probB > 0.5) {
            probB = 0.5 + (probB - 0.5) * (0.7 + confidenceFactor * 0.3);
            probP = 1 - probB;
        } else if (probP > 0.5) {
            probP = 0.5 + (probP - 0.5) * (0.7 + confidenceFactor * 0.3);
            probB = 1 - probP;
        }

        // ===== ĐẢM BẢO 50-80% =====
        const maxProb = 0.80;
        const minProb = 0.50;

        if (probB > maxProb) {
            const diff = probB - maxProb;
            probB = maxProb;
            probP += diff;
        } else if (probP > maxProb) {
            const diff = probP - maxProb;
            probP = maxProb;
            probB += diff;
        }

        if (probB < minProb && probP > maxProb) {
            probB = minProb;
            probP = 1 - minProb;
        } else if (probP < minProb && probB > maxProb) {
            probP = minProb;
            probB = 1 - minProb;
        }

        // Normalize
        const total = probB + probP;
        probB = Math.round((probB / total) * 1000) / 10;
        probP = Math.round((probP / total) * 1000) / 10;

        // Chọn dự đoán
        const prediction = probB > probP ? 'B' : 'P';

        return {
            prediction,
            probB,
            probP,
            cauInfo,
            currentStreak,
            lastChar,
            total: this.history.length,
            bCount: this.frequency.B,
            pCount: this.frequency.P,
            tCount: this.frequency.T,
            entropy: this.entropy,
            rawResult: this.rawResult
        };
    }

    getCurrentStreak() {
        if (this.history.length === 0) return 0;
        const current = this.history[this.history.length - 1];
        let streak = 0;
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i] === current) streak++;
            else break;
        }
        return streak;
    }
}

// ============================================================
// 6. API
// ============================================================

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const { tableId } = req.params;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const sessionKey = `${tableId}_${clientIp}`;
        
        if (!sessionData[sessionKey]) {
            sessionData[sessionKey] = { phien: 0, lastResult: '' };
        }
        
        const analyzer = new SieuVipAnalyzer(tableId);
        const success = await analyzer.fetchData();
        
        if (!success) {
            return res.json({
                success: false,
                error: 'Không có dữ liệu cho bàn này'
            });
        }
        
        const result = analyzer.predict();
        
        // Tăng phiên khi có kết quả mới
        if (sessionData[sessionKey].lastResult !== result.rawResult) {
            sessionData[sessionKey].phien += 1;
            sessionData[sessionKey].lastResult = result.rawResult;
        }
        
        res.json({
            success: true,
            data: {
                phien: sessionData[sessionKey].phien,
                duDoan: result.prediction,
                tiLe: `${result.probB}% - ${result.probP}%`,
                cau: {
                    loai: result.cauInfo.type || 'Chưa xác định',
                    moTa: result.cauInfo.description || '',
                    doTinCay: result.cauInfo.confidence || 0,
                    xuHuong: result.cauInfo.trend || '',
                    sucManh: result.cauInfo.strength || 0
                },
                cauGoc: result.rawResult,
                chuoiHienTai: result.lastChar.repeat(result.currentStreak) || 'Chưa có',
                thongKe: {
                    tongVan: result.total,
                    B: result.bCount,
                    P: result.pCount,
                    T: result.tCount,
                    entropy: result.entropy
                },
                topPatterns: result.cauInfo.topPatterns || []
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 7. BATCH API
// ============================================================

app.post('/api/predict/batch', async (req, res) => {
    try {
        const { tables = ['C01', 'C02', 'C03', '1', '2'] } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const results = [];
        
        for (const tableId of tables) {
            const sessionKey = `${tableId}_${clientIp}`;
            
            if (!sessionData[sessionKey]) {
                sessionData[sessionKey] = { phien: 0, lastResult: '' };
            }
            
            const analyzer = new SieuVipAnalyzer(String(tableId));
            const success = await analyzer.fetchData();
            
            if (success) {
                const result = analyzer.predict();
                
                if (sessionData[sessionKey].lastResult !== result.rawResult) {
                    sessionData[sessionKey].phien += 1;
                    sessionData[sessionKey].lastResult = result.rawResult;
                }
                
                results.push({
                    table: tableId,
                    phien: sessionData[sessionKey].phien,
                    duDoan: result.prediction,
                    tiLe: `${result.probB}% - ${result.probP}%`,
                    cau: result.cauInfo.type || 'Chưa xác định',
                    doTinCay: result.cauInfo.confidence || 0
                });
            }
        }
        
        res.json({
            success: true,
            data: results
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================
// 8. CÁC API KHÁC
// ============================================================

app.post('/api/reset/:tableId', (req, res) => {
    const { tableId } = req.params;
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const sessionKey = `${tableId}_${clientIp}`;
    
    if (sessionData[sessionKey]) {
        sessionData[sessionKey].phien = 0;
        sessionData[sessionKey].lastResult = '';
    }
    res.json({
        success: true,
        message: `Đã reset phiên cho bàn ${tableId}`
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: 'VIP 3.0',
        sessions: Object.keys(sessionData).length
    });
});

// ============================================================
// 9. START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 BCR SUPER VIP ANALYZER v3.0');
    console.log('========================================');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('📊 10 LOẠI CẦU ĐƯỢC NHẬN DIỆN:');
    console.log('  1. Cầu bệt');
    console.log('  2. Cầu đảo');
    console.log('  3. Cầu nhịp (2-2, 3-3, 2-3-2, 3-2-3)');
    console.log('  4. Cầu 1-1-2-2');
    console.log('  5. Cầu 2-2-1-1');
    console.log('  6. Cầu 3-3');
    console.log('  7. Cầu 2-3-2');
    console.log('  8. Cầu 3-2-3');
    console.log('  9. Cầu xen kẽ chéo');
    console.log('  10. Cầu hỗn hợp');
    console.log('========================================');
    console.log('📊 Tỉ lệ dự đoán: 50-80%');
    console.log('🔄 F5 không tăng phiên');
    console.log('📦 Hiển thị cầu gốc từ API');
    console.log('🎯 Không random, không cứng nhắc');
    console.log('========================================');
});
