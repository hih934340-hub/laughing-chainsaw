const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

let sessionData = {};

// ==================== LỚP PHÂN TÍCH CẦU BCR SIÊU LINH HOẠT ====================

class BCRSuperAnalyzer {
    constructor(tableId) {
        this.tableId = tableId;
        this.history = [];
        this.cauHistory = [];
        this.streakHistory = [];
        this.patternHistory = [];
        this.confidenceLevel = 0.5;
        this.cauType = 'Chưa xác định';
        this.cauStrength = 0;
        this.cauCycle = 0;
    }

    async fetchData() {
        try {
            const url = `https://symmetrical-carnival-d111.onrender.com/api/baccarat/${this.tableId}`;
            const response = await axios.get(url);
            if (response.data.success) {
                this.history = response.data.data.result.split('');
                this.buildHistory();
                return true;
            }
            return false;
        } catch (error) {
            return false;
        }
    }

    // Xây dựng lịch sử cầu
    buildHistory() {
        this.cauHistory = [];
        this.streakHistory = [];
        
        let currentStreak = 1;
        let currentChar = this.history[0];
        
        for (let i = 1; i < this.history.length; i++) {
            if (this.history[i] === currentChar) {
                currentStreak++;
            } else {
                this.cauHistory.push({
                    char: currentChar,
                    length: currentStreak
                });
                this.streakHistory.push(currentStreak);
                currentChar = this.history[i];
                currentStreak = 1;
            }
        }
        this.cauHistory.push({
            char: currentChar,
            length: currentStreak
        });
        this.streakHistory.push(currentStreak);
    }

    // ========== NHẬN DIỆN CẦU THÔNG MINH ==========
    
    detectCau() {
        if (this.cauHistory.length < 2) {
            return {
                type: 'Chưa đủ dữ liệu',
                confidence: 30,
                description: 'Cần thêm ván để phân tích'
            };
        }

        const last3Cau = this.cauHistory.slice(-3);
        const last5Cau = this.cauHistory.slice(-5);
        const last10Cau = this.cauHistory.slice(-10);
        
        const result = {
            mainType: 'Cầu hỗn hợp',
            subType: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        // 1. KIỂM TRA CẦU BỆT
        const bệtCheck = this.checkBệt(last3Cau);
        if (bệtCheck.isBệt) {
            result.mainType = 'Cầu bệt';
            result.subType = bệtCheck.type;
            result.confidence = bệtCheck.confidence;
            result.description = bệtCheck.description;
            result.trend = bệtCheck.trend;
            result.strength = bệtCheck.strength;
            result.pattern = bệtCheck.pattern;
            return result;
        }

        // 2. KIỂM TRA CẦU ĐẢO
        const đảoCheck = this.checkĐảo(last5Cau);
        if (đảoCheck.isĐảo) {
            result.mainType = 'Cầu đảo';
            result.subType = đảoCheck.type;
            result.confidence = đảoCheck.confidence;
            result.description = đảoCheck.description;
            result.trend = đảoCheck.trend;
            result.strength = đảoCheck.strength;
            result.pattern = đảoCheck.pattern;
            return result;
        }

        // 3. KIỂM TRA CẦU NHỊP
        const nhịpCheck = this.checkNhịp(last5Cau);
        if (nhịpCheck.isNhịp) {
            result.mainType = 'Cầu nhịp';
            result.subType = nhịpCheck.type;
            result.confidence = nhịpCheck.confidence;
            result.description = nhịpCheck.description;
            result.trend = nhịpCheck.trend;
            result.strength = nhịpCheck.strength;
            result.pattern = nhịpCheck.pattern;
            return result;
        }

        // 4. KIỂM TRA CẦU 1-1-2-2
        const oneOneTwoTwo = this.checkOneOneTwoTwo(last5Cau);
        if (oneOneTwoTwo.isMatch) {
            result.mainType = 'Cầu 1-1-2-2';
            result.subType = oneOneTwoTwo.type;
            result.confidence = oneOneTwoTwo.confidence;
            result.description = oneOneTwoTwo.description;
            result.trend = oneOneTwoTwo.trend;
            result.strength = oneOneTwoTwo.strength;
            result.pattern = oneOneTwoTwo.pattern;
            return result;
        }

        // 5. KIỂM TRA CẦU 2-2-1-1
        const twoTwoOneOne = this.checkTwoTwoOneOne(last5Cau);
        if (twoTwoOneOne.isMatch) {
            result.mainType = 'Cầu 2-2-1-1';
            result.subType = twoTwoOneOne.type;
            result.confidence = twoTwoOneOne.confidence;
            result.description = twoTwoOneOne.description;
            result.trend = twoTwoOneOne.trend;
            result.strength = twoTwoOneOne.strength;
            result.pattern = twoTwoOneOne.pattern;
            return result;
        }

        // 6. KIỂM TRA CẦU 3-3
        const threeThree = this.checkThreeThree(last5Cau);
        if (threeThree.isMatch) {
            result.mainType = 'Cầu 3-3';
            result.subType = threeThree.type;
            result.confidence = threeThree.confidence;
            result.description = threeThree.description;
            result.trend = threeThree.trend;
            result.strength = threeThree.strength;
            result.pattern = threeThree.pattern;
            return result;
        }

        // 7. KIỂM TRA CẦU 2-3-2
        const twoThreeTwo = this.checkTwoThreeTwo(last5Cau);
        if (twoThreeTwo.isMatch) {
            result.mainType = 'Cầu 2-3-2';
            result.subType = twoThreeTwo.type;
            result.confidence = twoThreeTwo.confidence;
            result.description = twoThreeTwo.description;
            result.trend = twoThreeTwo.trend;
            result.strength = twoThreeTwo.strength;
            result.pattern = twoThreeTwo.pattern;
            return result;
        }

        // 8. KIỂM TRA CẦU 3-2-3
        const threeTwoThree = this.checkThreeTwoThree(last5Cau);
        if (threeTwoThree.isMatch) {
            result.mainType = 'Cầu 3-2-3';
            result.subType = threeTwoThree.type;
            result.confidence = threeTwoThree.confidence;
            result.description = threeTwoThree.description;
            result.trend = threeTwoThree.trend;
            result.strength = threeTwoThree.strength;
            result.pattern = threeTwoThree.pattern;
            return result;
        }

        // 9. KIỂM TRA CẦU XEN KẼ CHÉO
        const crossCheck = this.checkCross(last5Cau);
        if (crossCheck.isCross) {
            result.mainType = 'Cầu xen kẽ chéo';
            result.subType = crossCheck.type;
            result.confidence = crossCheck.confidence;
            result.description = crossCheck.description;
            result.trend = crossCheck.trend;
            result.strength = crossCheck.strength;
            result.pattern = crossCheck.pattern;
            return result;
        }

        // 10. PHÂN TÍCH TỔNG QUÁT
        return this.analyzeMixed(last10Cau, last5Cau);
    }

    // ========== HÀM KIỂM TRA CÁC LOẠI CẦU ==========

    // 1. KIỂM TRA CẦU BỆT
    checkBệt(last3Cau) {
        const result = {
            isBệt: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last3Cau.length < 2) return result;

        // Kiểm tra 2 cầu cuối cùng có cùng cửa không
        const last1 = last3Cau[last3Cau.length - 1];
        const last2 = last3Cau[last3Cau.length - 2];
        
        if (last1.char === last2.char) {
            const totalLength = last1.length + last2.length;
            const avgLength = this.streakHistory.reduce((a, b) => a + b, 0) / this.streakHistory.length;
            
            result.isBệt = true;
            result.type = `Bệt ${last1.char}`;
            
            // Độ tin cậy dựa trên độ dài
            if (totalLength >= 8) {
                result.confidence = 85;
                result.description = `Cầu bệt siêu dài ${last1.char} (${totalLength} ván), khả năng đảo chiều rất cao`;
                result.trend = 'Sắp đảo';
                result.strength = 90;
            } else if (totalLength >= 5) {
                result.confidence = 75;
                result.description = `Cầu bệt dài ${last1.char} (${totalLength} ván), khả năng tiếp tục hoặc đảo`;
                result.trend = 'Đang mạnh';
                result.strength = 80;
            } else if (totalLength >= 3) {
                result.confidence = 60;
                result.description = `Cầu bệt vừa ${last1.char} (${totalLength} ván)`;
                result.trend = 'Đang hình thành';
                result.strength = 65;
            } else {
                result.confidence = 45;
                result.description = `Cầu bệt nhỏ ${last1.char}`;
                result.trend = 'Yếu';
                result.strength = 50;
            }

            result.pattern = [last1.char.repeat(totalLength)];
            
            // Điều chỉnh dựa trên trung bình
            if (totalLength > avgLength * 1.5) {
                result.confidence = Math.min(95, result.confidence + 10);
                result.description += ' - Vượt trung bình, cẩn thận đảo chiều';
            }
        }

        return result;
    }

    // 2. KIỂM TRA CẦU ĐẢO
    checkĐảo(last5Cau) {
        const result = {
            isĐảo: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 4) return result;

        // Kiểm tra xen kẽ B-P-B-P hoặc P-B-P-B
        let isAlternating = true;
        let pattern = [];
        
        for (let i = 0; i < last5Cau.length - 1; i++) {
            if (last5Cau[i].char === last5Cau[i + 1].char) {
                isAlternating = false;
                break;
            }
            pattern.push(last5Cau[i].char);
        }

        if (isAlternating && pattern.length >= 3) {
            result.isĐảo = true;
            result.type = `Đảo ${pattern.join('')}`;
            result.pattern = pattern;
            
            const length = pattern.length;
            
            if (length >= 5) {
                result.confidence = 85;
                result.description = 'Cầu đảo hoàn hảo, theo quy luật xen kẽ';
                result.trend = 'Tiếp tục đảo';
                result.strength = 88;
            } else if (length >= 4) {
                result.confidence = 75;
                result.description = 'Cầu đảo mạnh, khả năng cao tiếp tục';
                result.trend = 'Đang đảo';
                result.strength = 78;
            } else {
                result.confidence = 60;
                result.description = 'Cầu đảo vừa, còn yếu';
                result.trend = 'Bắt đầu đảo';
                result.strength = 65;
            }

            // Điều chỉnh độ tin cậy dựa trên lịch sử
            if (this.cauHistory.length > 10) {
                const đảoCount = this.cauHistory.filter((c, i) => 
                    i < this.cauHistory.length - 1 && c.char !== this.cauHistory[i+1].char
                ).length;
                const tỉLệĐảo = đảoCount / (this.cauHistory.length - 1);
                
                if (tỉLệĐảo > 0.7) {
                    result.confidence = Math.min(95, result.confidence + 10);
                    result.description += ' - Có xu hướng đảo mạnh trong lịch sử';
                }
            }
        }

        return result;
    }

    // 3. KIỂM TRA CẦU NHỊP
    checkNhịp(last5Cau) {
        const result = {
            isNhịp: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 4) return result;

        // Kiểm tra mô hình 2-2-2 hoặc 3-3
        const lengths = last5Cau.slice(-4).map(c => c.length);
        const chars = last5Cau.slice(-4).map(c => c.char);
        
        // Kiểm tra 2-2
        if (lengths.length >= 2 && lengths[0] === lengths[1] && lengths[1] === lengths[2]) {
            if (chars[0] !== chars[1] && chars[1] !== chars[2]) {
                result.isNhịp = true;
                result.type = `Nhịp ${lengths[0]}-${lengths[0]}`;
                result.pattern = chars.map((c, i) => c.repeat(lengths[i]));
                
                result.confidence = 75;
                result.description = `Cầu nhịp ${lengths[0]}-${lengths[0]} đang diễn ra`;
                result.trend = 'Tiếp tục nhịp';
                result.strength = 80;
            }
        }

        // Kiểm tra 3-3-2
        if (lengths.length >= 3 && 
            lengths[0] === lengths[1] && 
            lengths[1] === 3 && 
            lengths[2] === 2) {
            result.isNhịp = true;
            result.type = 'Nhịp 3-3-2';
            result.pattern = chars.map((c, i) => c.repeat(lengths[i]));
            
            result.confidence = 70;
            result.description = 'Cầu nhịp 3-3-2 đang hình thành';
            result.trend = 'Biến đổi từ 3 sang 2';
            result.strength = 72;
        }

        // Kiểm tra 2-3-2
        if (lengths.length >= 3 && 
            lengths[0] === 2 && 
            lengths[1] === 3 && 
            lengths[2] === 2) {
            result.isNhịp = true;
            result.type = 'Nhịp 2-3-2';
            result.pattern = chars.map((c, i) => c.repeat(lengths[i]));
            
            result.confidence = 78;
            result.description = 'Cầu nhịp 2-3-2 đặc biệt, khá ổn định';
            result.trend = 'Quay về 2';
            result.strength = 82;
        }

        return result;
    }

    // 4. KIỂM TRA CẦU 1-1-2-2
    checkOneOneTwoTwo(last5Cau) {
        const result = {
            isMatch: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 4) return result;

        const last4 = last5Cau.slice(-4);
        const lengths = last4.map(c => c.length);
        const chars = last4.map(c => c.char);

        if (lengths[0] === 1 && lengths[1] === 1 && lengths[2] === 2 && lengths[3] === 2) {
            result.isMatch = true;
            result.type = '1-1-2-2';
            result.pattern = chars.map((c, i) => c.repeat(lengths[i]));
            result.confidence = 80;
            result.description = 'Cầu 1-1-2-2, xu hướng tăng dần';
            result.trend = 'Tiếp tục tăng';
            result.strength = 85;
        }

        return result;
    }

    // 5. KIỂM TRA CẦU 2-2-1-1
    checkTwoTwoOneOne(last5Cau) {
        const result = {
            isMatch: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 4) return result;

        const last4 = last5Cau.slice(-4);
        const lengths = last4.map(c => c.length);
        const chars = last4.map(c => c.char);

        if (lengths[0] === 2 && lengths[1] === 2 && lengths[2] === 1 && lengths[3] === 1) {
            result.isMatch = true;
            result.type = '2-2-1-1';
            result.pattern = chars.map((c, i) => c.repeat(lengths[i]));
            result.confidence = 80;
            result.description = 'Cầu 2-2-1-1, xu hướng giảm dần';
            result.trend = 'Tiếp tục giảm';
            result.strength = 85;
        }

        return result;
    }

    // 6. KIỂM TRA CẦU 3-3
    checkThreeThree(last5Cau) {
        const result = {
            isMatch: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 2) return result;

        const last2 = last5Cau.slice(-2);
        
        if (last2[0].length === 3 && last2[1].length === 3 && last2[0].char !== last2[1].char) {
            result.isMatch = true;
            result.type = '3-3';
            result.pattern = [last2[0].char.repeat(3), last2[1].char.repeat(3)];
            result.confidence = 85;
            result.description = 'Cầu 3-3 mạnh, cân bằng';
            result.trend = 'Có thể tiếp tục 3-3';
            result.strength = 88;
        }

        return result;
    }

    // 7. KIỂM TRA CẦU 2-3-2
    checkTwoThreeTwo(last5Cau) {
        const result = {
            isMatch: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 3) return result;

        const last3 = last5Cau.slice(-3);
        
        if (last3[0].length === 2 && last3[1].length === 3 && last3[2].length === 2) {
            result.isMatch = true;
            result.type = '2-3-2';
            result.pattern = last3.map(c => c.char.repeat(c.length));
            result.confidence = 82;
            result.description = 'Cầu 2-3-2, đang ở đỉnh 3';
            result.trend = 'Sắp về 2';
            result.strength = 84;
        }

        return result;
    }

    // 8. KIỂM TRA CẦU 3-2-3
    checkThreeTwoThree(last5Cau) {
        const result = {
            isMatch: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 3) return result;

        const last3 = last5Cau.slice(-3);
        
        if (last3[0].length === 3 && last3[1].length === 2 && last3[2].length === 3) {
            result.isMatch = true;
            result.type = '3-2-3';
            result.pattern = last3.map(c => c.char.repeat(c.length));
            result.confidence = 82;
            result.description = 'Cầu 3-2-3, đang ở đáy 2';
            result.trend = 'Sắp về 3';
            result.strength = 84;
        }

        return result;
    }

    // 9. KIỂM TRA CẦU XEN KẼ CHÉO
    checkCross(last5Cau) {
        const result = {
            isCross: false,
            type: '',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        if (last5Cau.length < 3) return result;

        const last3 = last5Cau.slice(-3);
        
        // B-P-B hoặc P-B-P với độ dài bất kỳ
        if (last3[0].char !== last3[1].char && last3[1].char !== last3[2].char && last3[0].char === last3[2].char) {
            result.isCross = true;
            result.type = 'Xen kẽ chéo';
            result.pattern = last3.map(c => c.char.repeat(c.length));
            
            // Đánh giá dựa trên độ dài
            const avgLen = (last3[0].length + last3[2].length) / 2;
            if (avgLen >= 3) {
                result.confidence = 85;
                result.description = 'Cầu xen kẽ chéo mạnh, đang mở rộng';
                result.trend = 'Tiếp tục mở rộng';
                result.strength = 88;
            } else if (avgLen >= 2) {
                result.confidence = 70;
                result.description = 'Cầu xen kẽ chéo vừa';
                result.trend = 'Đang ổn định';
                result.strength = 75;
            } else {
                result.confidence = 55;
                result.description = 'Cầu xen kẽ chéo yếu';
                result.trend = 'Đang hình thành';
                result.strength = 60;
            }
        }

        return result;
    }

    // 10. PHÂN TÍCH CẦU HỖN HỢP
    analyzeMixed(last10Cau, last5Cau) {
        const result = {
            mainType: 'Cầu hỗn hợp',
            subType: 'Không rõ quy luật',
            confidence: 0,
            description: '',
            trend: '',
            strength: 0,
            pattern: []
        };

        // Phân tích xu hướng tổng thể
        const bCount = this.history.filter(c => c === 'B').length;
        const pCount = this.history.filter(c => c === 'P').length;
        const total = this.history.length;

        // Tỉ lệ tổng
        const ratioB = bCount / total;
        const ratioP = pCount / total;

        // Tỉ lệ 10 ván gần nhất
        const last20 = this.history.slice(-20);
        const bLast20 = last20.filter(c => c === 'B').length;
        const pLast20 = last20.filter(c => c === 'P').length;

        // Phân tích xu hướng
        let trend = '';
        let strength = 0;
        let description = '';

        if (Math.abs(ratioB - ratioP) < 0.1) {
            trend = 'Cân bằng mạnh';
            strength = 60;
            description = 'B và P xuất hiện cân bằng, khó dự đoán';
            result.confidence = 55;
        } else if (ratioB > ratioP) {
            const diff = ratioB - ratioP;
            if (diff > 0.2) {
                trend = 'B áp đảo';
                strength = 75;
                description = `B chiếm ${Math.round(ratioB * 100)}%, áp đảo P`;
                result.confidence = 70;
            } else {
                trend = 'B hơn P';
                strength = 60;
                description = `B hơn P ${Math.round(diff * 100)}%`;
                result.confidence = 60;
            }
        } else {
            const diff = ratioP - ratioB;
            if (diff > 0.2) {
                trend = 'P áp đảo';
                strength = 75;
                description = `P chiếm ${Math.round(ratioP * 100)}%, áp đảo B`;
                result.confidence = 70;
            } else {
                trend = 'P hơn B';
                strength = 60;
                description = `P hơn B ${Math.round(diff * 100)}%`;
                result.confidence = 60;
            }
        }

        // Kiểm tra xu hướng gần đây
        if (Math.abs(bLast20 - pLast20) <= 2) {
            trend += ', đang cân bằng';
            description += ', 20 ván gần đây rất cân bằng';
            result.confidence = Math.max(50, result.confidence - 5);
        } else if (bLast20 > pLast20 + 4) {
            trend += ', đang lên B';
            description += ', 20 ván gần đây nghiêng về B';
            result.confidence = Math.min(75, result.confidence + 5);
        } else if (pLast20 > bLast20 + 4) {
            trend += ', đang lên P';
            description += ', 20 ván gần đây nghiêng về P';
            result.confidence = Math.min(75, result.confidence + 5);
        }

        result.trend = trend;
        result.strength = strength;
        result.description = description;

        // Thêm pattern mẫu
        if (last5Cau.length >= 3) {
            result.pattern = last5Cau.slice(-3).map(c => c.char.repeat(c.length));
        }

        return result;
    }

    // ========== DỰ ĐOÁN LINH HOẠT ==========
    
    predict() {
        const cauInfo = this.detectCau();
        const currentStreak = this.getCurrentStreak();
        const lastChar = this.history[this.history.length - 1] || 'B';
        const avgStreak = this.streakHistory.reduce((a, b) => a + b, 0) / this.streakHistory.length;

        let probB = 0.5;
        let probP = 0.5;

        // Dựa trên loại cầu đã nhận diện
        switch(cauInfo.mainType) {
            case 'Cầu bệt':
                if (currentStreak >= 5) {
                    // Bệt dài, khả năng đảo
                    if (lastChar === 'B') {
                        probP = 0.70 + (currentStreak - 5) * 0.03;
                        probB = 1 - probP;
                    } else {
                        probB = 0.70 + (currentStreak - 5) * 0.03;
                        probP = 1 - probB;
                    }
                } else if (currentStreak >= 3) {
                    // Bệt vừa, khả năng tiếp tục
                    if (lastChar === 'B') {
                        probB = 0.65;
                        probP = 0.35;
                    } else {
                        probP = 0.65;
                        probB = 0.35;
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
                break;

            case 'Cầu đảo':
                if (lastChar === 'B') {
                    probP = 0.68;
                    probB = 0.32;
                } else {
                    probB = 0.68;
                    probP = 0.32;
                }
                // Tăng độ tin cậy nếu đảo dài
                if (cauInfo.confidence > 80) {
                    if (lastChar === 'B') probP += 0.05;
                    else probB += 0.05;
                }
                break;

            case 'Cầu nhịp':
                // Theo mô hình nhịp
                const last3 = this.cauHistory.slice(-3);
                if (last3.length >= 2) {
                    const lastLen = last3[last3.length - 1].length;
                    const prevLen = last3[last3.length - 2].length;
                    
                    // Dự đoán độ dài tiếp theo
                    let nextLen = 0;
                    if (lastLen === prevLen) {
                        // Cùng độ dài, tiếp tục
                        nextLen = lastLen;
                    } else if (lastLen > prevLen) {
                        // Đang tăng, có thể giảm
                        nextLen = lastLen - 1;
                    } else {
                        // Đang giảm, có thể tăng
                        nextLen = lastLen + 1;
                    }
                    
                    // Dựa vào độ dài dự đoán để chọn cửa
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextLen >= 3) {
                        if (nextChar === 'B') probB = 0.65;
                        else probP = 0.65;
                    } else {
                        if (nextChar === 'B') probB = 0.55;
                        else probP = 0.55;
                    }
                }
                break;

            case 'Cầu 1-1-2-2':
            case 'Cầu 2-2-1-1':
                // Theo quy luật tăng/giảm
                const currentLen = this.cauHistory[this.cauHistory.length - 1].length;
                if (cauInfo.mainType === 'Cầu 1-1-2-2') {
                    // Đang tăng
                    if (currentLen === 2) {
                        const nextChar = lastChar === 'B' ? 'P' : 'B';
                        if (nextChar === 'B') probB = 0.68;
                        else probP = 0.68;
                    }
                } else {
                    // Đang giảm
                    if (currentLen === 1) {
                        const nextChar = lastChar === 'B' ? 'P' : 'B';
                        if (nextChar === 'B') probB = 0.68;
                        else probP = 0.68;
                    }
                }
                break;

            case 'Cầu 3-3':
                if (currentStreak === 3) {
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextChar === 'B') probB = 0.72;
                    else probP = 0.72;
                } else if (currentStreak === 2) {
                    if (lastChar === 'B') probB = 0.62;
                    else probP = 0.62;
                }
                break;

            case 'Cầu 2-3-2':
                if (currentStreak === 3) {
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextChar === 'B') probB = 0.70;
                    else probP = 0.70;
                }
                break;

            case 'Cầu 3-2-3':
                if (currentStreak === 2) {
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextChar === 'B') probB = 0.70;
                    else probP = 0.70;
                }
                break;

            case 'Cầu xen kẽ chéo':
                const nextCharCross = lastChar === 'B' ? 'P' : 'B';
                if (nextCharCross === 'B') probB = 0.72;
                else probP = 0.72;
                break;

            default: // Cầu hỗn hợp
                // Dùng phân tích thống kê
                const ratio = this.history.filter(c => c === 'B').length / this.history.length;
                if (ratio > 0.55) {
                    probB = 0.55 + (ratio - 0.55) * 0.5;
                    probP = 1 - probB;
                } else if (ratio < 0.45) {
                    probP = 0.55 + (0.45 - ratio) * 0.5;
                    probB = 1 - probP;
                } else {
                    probB = 0.52;
                    probP = 0.48;
                }
                break;
        }

        // Điều chỉnh dựa trên độ tin cậy
        const confidenceFactor = cauInfo.confidence / 100;
        if (probB > 0.5) {
            probB = 0.5 + (probB - 0.5) * (0.7 + confidenceFactor * 0.3);
            probP = 1 - probB;
        } else if (probP > 0.5) {
            probP = 0.5 + (probP - 0.5) * (0.7 + confidenceFactor * 0.3);
            probB = 1 - probP;
        }

        // Đảm bảo tỉ lệ trong khoảng 50-80%
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
            total: this.history.length
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

// ==================== API ====================

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const { tableId } = req.params;
        
        if (!sessionData[tableId]) {
            sessionData[tableId] = { phien: 0 };
        }
        sessionData[tableId].phien += 1;

        const analyzer = new BCRSuperAnalyzer(tableId);
        const success = await analyzer.fetchData();

        if (!success) {
            return res.json({
                success: false,
                error: 'Không lấy được dữ liệu'
            });
        }

        const result = analyzer.predict();

        // Format output theo yêu cầu
        const response = {
            success: true,
            data: {
                phien: sessionData[tableId].phien,
                duDoan: result.prediction,
                tiLe: `${result.probB}% - ${result.probP}%`,
                cau: `${result.cauInfo.mainType} ${result.cauInfo.subType}`,
                moTaCau: result.cauInfo.description,
                doTinCay: result.cauInfo.confidence,
                chuoiHienTai: result.lastChar.repeat(result.currentStreak) || 'Chưa có',
                tongVan: result.total
            }
        };

        res.json(response);

    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/predict/batch', async (req, res) => {
    try {
        const { tables = ['C01', 'C02', '1'] } = req.body;
        const results = [];

        for (const tableId of tables) {
            if (!sessionData[tableId]) {
                sessionData[tableId] = { phien: 0 };
            }
            sessionData[tableId].phien += 1;

            const analyzer = new BCRSuperAnalyzer(String(tableId));
            const success = await analyzer.fetchData();

            if (success) {
                const result = analyzer.predict();
                results.push({
                    table: tableId,
                    phien: sessionData[tableId].phien,
                    duDoan: result.prediction,
                    tiLe: `${result.probB}% - ${result.probP}%`,
                    cau: `${result.cauInfo.mainType} ${result.cauInfo.subType}`,
                    doTinCay: result.cauInfo.confidence
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

app.post('/api/reset/:tableId', (req, res) => {
    const { tableId } = req.params;
    if (sessionData[tableId]) {
        sessionData[tableId].phien = 0;
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
        sessions: Object.keys(sessionData).length
    });
});

app.listen(PORT, () => {
    console.log('🚀 BCR Super Analyzer');
    console.log(`📡 Port: ${PORT}`);
    console.log('🔍 10 loại cầu được nhận diện:');
    console.log('  1. Cầu bệt');
    console.log('  2. Cầu đảo');
    console.log('  3. Cầu nhịp');
    console.log('  4. Cầu 1-1-2-2');
    console.log('  5. Cầu 2-2-1-1');
    console.log('  6. Cầu 3-3');
    console.log('  7. Cầu 2-3-2');
    console.log('  8. Cầu 3-2-3');
    console.log('  9. Cầu xen kẽ chéo');
    console.log('  10. Cầu hỗn hợp');
    console.log('📊 Tỉ lệ dự đoán: 50-80%');
    console.log('🔄 Không random, không cứng nhắc');
});
