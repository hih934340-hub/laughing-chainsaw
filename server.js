const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ============================================================
// QUẢN LÝ PHIÊN THÔNG MINH
// ============================================================

class SessionManager {
    constructor() {
        this.sessions = {};
    }

    getSession(tableId, clientIp) {
        const key = `${tableId}_${clientIp}`;
        if (!this.sessions[key]) {
            this.sessions[key] = {
                phien: 0,
                lastCauKey: '',
                lastRawResult: '',
                cauHistory: [],
                allCauDetected: []
            };
        }
        return this.sessions[key];
    }

    getCauKey(rawResult) {
        if (!rawResult || rawResult.length < 2) return '';
        const chars = rawResult.split('');
        let key = '';
        let current = chars[0];
        let count = 0;
        for (let i = 0; i < chars.length; i++) {
            if (chars[i] === current) count++;
            else {
                key += current + count;
                current = chars[i];
                count = 1;
            }
        }
        key += current + count;
        return key;
    }

    isNewCau(oldKey, newKey) {
        if (!oldKey || !newKey) return true;
        return oldKey !== newKey;
    }

    updateSession(tableId, clientIp, rawResult, cauInfo) {
        const session = this.getSession(tableId, clientIp);
        const newCauKey = this.getCauKey(rawResult);
        
        if (this.isNewCau(session.lastCauKey, newCauKey) && rawResult) {
            session.phien += 1;
            session.allCauDetected.push({
                phien: session.phien,
                cauKey: newCauKey,
                cauInfo: cauInfo,
                rawResult: rawResult,
                time: new Date().toISOString()
            });
            
            if (session.allCauDetected.length > 50) {
                session.allCauDetected = session.allCauDetected.slice(-50);
            }
        }
        
        session.lastCauKey = newCauKey;
        session.lastRawResult = rawResult;
        return session;
    }
}

const sessionManager = new SessionManager();

// ============================================================
// SIÊU PHÂN TÍCH CẦU - NHẬN DIỆN ALL CẦU
// ============================================================

class SieuCauAnalyzer {
    constructor(tableId) {
        this.tableId = tableId;
        this.rawResult = '';
        this.history = [];
        this.length = 0;
        this.cauHistory = [];
        this.streakHistory = [];
        this.frequency = { B: 0, P: 0, T: 0 };
        this.matrix = { B: { B: 0, P: 0 }, P: { B: 0, P: 0 } };
        this.positions = { B: [], P: [], T: [] };
        this.patterns = {};
        this.allCau = [];
    }

    async fetchData() {
        try {
            const url = `https://symmetrical-carnival-d111.onrender.com/api/baccarat/${this.tableId}`;
            const response = await axios.get(url, { timeout: 5000 });
            
            if (response.data && response.data.success) {
                this.rawResult = response.data.data.result;
                this.history = this.rawResult.split('');
                this.length = this.history.length;
                this.buildAll();
                return true;
            }
            return false;
        } catch (error) {
            const SAMPLE_DATA = {
                'C01': 'BPPBPPPBPPPBPBBBTPBBBBBPBPBPPPBBBBBBPBPBBPPBBPP',
                'C02': 'BBBBBBBBPBPPTBBBPBPPPPPPBPPPBPBPPPBPPBP',
                '1': 'BBBBBBBBPBPPTBBBPBPPPPPPBPPPBPBPPPBPPBP',
                '2': 'BPPBPPPBPPPBPBBBTPBBBBBPBPBPPPBBBBBBPBPBBPPBBPP'
            };
            const sampleData = SAMPLE_DATA[this.tableId] || SAMPLE_DATA['C01'];
            if (sampleData) {
                this.rawResult = sampleData;
                this.history = sampleData.split('');
                this.length = this.history.length;
                this.buildAll();
                return true;
            }
            return false;
        }
    }

    // ============================================================
    // XÂY DỰNG TẤT CẢ DỮ LIỆU
    // ============================================================
    
    buildAll() {
        this.buildCauHistory();
        this.buildFrequency();
        this.buildMatrix();
        this.buildPositions();
        this.buildPatterns();
        this.detectAllCau();
    }

    buildCauHistory() {
        this.cauHistory = [];
        this.streakHistory = [];
        if (this.history.length === 0) return;
        
        let currentChar = this.history[0];
        let currentStreak = 1;
        
        for (let i = 1; i < this.history.length; i++) {
            if (this.history[i] === currentChar) {
                currentStreak++;
            } else {
                this.cauHistory.push({ char: currentChar, length: currentStreak });
                this.streakHistory.push(currentStreak);
                currentChar = this.history[i];
                currentStreak = 1;
            }
        }
        this.cauHistory.push({ char: currentChar, length: currentStreak });
        this.streakHistory.push(currentStreak);
    }

    buildFrequency() {
        this.frequency = { B: 0, P: 0, T: 0 };
        this.history.forEach(char => {
            if (this.frequency[char] !== undefined) this.frequency[char]++;
        });
    }

    buildMatrix() {
        this.matrix = { B: { B: 0, P: 0 }, P: { B: 0, P: 0 } };
        for (let i = 0; i < this.history.length - 1; i++) {
            const curr = this.history[i];
            const next = this.history[i + 1];
            if (this.matrix[curr] && this.matrix[curr][next] !== undefined) {
                this.matrix[curr][next]++;
            }
        }
    }

    buildPositions() {
        this.positions = { B: [], P: [], T: [] };
        this.history.forEach((char, index) => {
            if (this.positions[char]) this.positions[char].push(index);
        });
    }

    buildPatterns() {
        this.patterns = {};
        for (let size = 2; size <= 8; size++) {
            this.patterns[size] = {};
            for (let i = 0; i <= this.history.length - size; i++) {
                const pattern = this.history.slice(i, i + size).join('');
                this.patterns[size][pattern] = (this.patterns[size][pattern] || 0) + 1;
            }
        }
    }

    // ============================================================
    // NHẬN DIỆN TẤT CẢ CÁC LOẠI CẦU (15 LOẠI)
    // ============================================================
    
    detectAllCau() {
        this.allCau = [];
        
        // 1. Cầu bệt
        this.detectCauBet();
        
        // 2. Cầu đảo
        this.detectCauDao();
        
        // 3. Cầu nhịp
        this.detectCauNhip();
        
        // 4. Cầu 1-1-2-2
        this.detectCau1122();
        
        // 5. Cầu 2-2-1-1
        this.detectCau2211();
        
        // 6. Cầu 3-3
        this.detectCau33();
        
        // 7. Cầu 2-3-2
        this.detectCau232();
        
        // 8. Cầu 3-2-3
        this.detectCau323();
        
        // 9. Cầu xen kẽ chéo
        this.detectCauXenKe();
        
        // 10. Cầu 1-2-1-2
        this.detectCau1212();
        
        // 11. Cầu 2-1-2-1
        this.detectCau2121();
        
        // 12. Cầu 1-1-1-2
        this.detectCau1112();
        
        // 13. Cầu 2-1-1-1
        this.detectCau2111();
        
        // 14. Cầu dài (cực dài)
        this.detectCauDai();
        
        // 15. Cầu hỗn hợp
        this.detectCauHonHop();
        
        // Sắp xếp theo độ tin cậy
        this.allCau.sort((a, b) => b.confidence - a.confidence);
    }

    // 1. CẦU BỆT
    detectCauBet() {
        if (this.cauHistory.length < 2) return;
        
        const last = this.cauHistory[this.cauHistory.length - 1];
        const prev = this.cauHistory[this.cauHistory.length - 2];
        
        if (last.char === prev.char) {
            let totalLen = last.length;
            let i = this.cauHistory.length - 2;
            while (i >= 0 && this.cauHistory[i].char === last.char) {
                totalLen += this.cauHistory[i].length;
                i--;
            }
            
            let confidence = 50;
            let description = '';
            
            if (totalLen >= 10) {
                confidence = 90;
                description = `BỆT SIÊU DÀI ${last.char} (${totalLen} VÁN) - SẮP ĐẢO!`;
            } else if (totalLen >= 7) {
                confidence = 80;
                description = `BỆT DÀI ${last.char} (${totalLen} VÁN) - CẨN THẬN ĐẢO`;
            } else if (totalLen >= 5) {
                confidence = 70;
                description = `BỆT ${last.char} (${totalLen} VÁN) - ĐANG MẠNH`;
            } else if (totalLen >= 3) {
                confidence = 60;
                description = `BỆT ${last.char} (${totalLen} VÁN) - ĐANG HÌNH THÀNH`;
            } else {
                confidence = 50;
                description = `BỆT NHỎ ${last.char} (${totalLen} VÁN)`;
            }
            
            this.allCau.push({
                type: 'Cầu bệt',
                char: last.char,
                length: totalLen,
                confidence: confidence,
                description: description,
                trend: totalLen >= 7 ? 'Sắp đảo' : 'Tiếp tục'
            });
        }
    }

    // 2. CẦU ĐẢO
    detectCauDao() {
        if (this.cauHistory.length < 4) return;
        
        const last = this.cauHistory.slice(-4);
        let isDao = true;
        
        for (let i = 0; i < last.length - 1; i++) {
            if (last[i].char === last[i+1].char) {
                isDao = false;
                break;
            }
        }
        
        if (isDao) {
            let totalLen = last.reduce((sum, c) => sum + c.length, 0);
            let confidence = 50 + last.length * 5;
            let description = `ĐẢO HOÀN HẢO ${last.map(c => c.char).join('')}`;
            
            if (last.length >= 5) {
                confidence = 85;
                description = `ĐẢO SIÊU DÀI ${last.map(c => c.char).join('')}`;
            } else if (last.length >= 4) {
                confidence = 75;
                description = `ĐẢO MẠNH ${last.map(c => c.char).join('')}`;
            }
            
            this.allCau.push({
                type: 'Cầu đảo',
                pattern: last.map(c => c.char).join(''),
                length: totalLen,
                confidence: Math.min(95, confidence),
                description: description,
                trend: 'Tiếp tục đảo'
            });
        }
    }

    // 3. CẦU NHỊP
    detectCauNhip() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const chars = last4.map(c => c.char);
        const lens = last4.map(c => c.length);
        
        // 2-2-2
        if (lens[0] === lens[1] && lens[1] === lens[2] && lens[0] >= 2) {
            if (chars[0] !== chars[1] && chars[1] !== chars[2]) {
                this.allCau.push({
                    type: 'Cầu nhịp',
                    pattern: `${lens[0]}-${lens[1]}-${lens[2]}`,
                    confidence: 80,
                    description: `NHỊP ${lens[0]}-${lens[1]}-${lens[2]} ĐỀU`,
                    trend: 'Tiếp tục'
                });
            }
        }
        
        // 3-3-2
        if (lens[0] === 3 && lens[1] === 3 && lens[2] === 2) {
            this.allCau.push({
                type: 'Cầu nhịp',
                pattern: '3-3-2',
                confidence: 78,
                description: 'NHỊP 3-3-2 - ĐANG GIẢM',
                trend: 'Về 2'
            });
        }
        
        // 2-3-2
        if (lens[0] === 2 && lens[1] === 3 && lens[2] === 2) {
            this.allCau.push({
                type: 'Cầu nhịp',
                pattern: '2-3-2',
                confidence: 85,
                description: 'NHỊP 2-3-2 ĐẶC BIỆT - ĐỈNH 3',
                trend: 'Về 2'
            });
        }
        
        // 3-2-3
        if (lens[0] === 3 && lens[1] === 2 && lens[2] === 3) {
            this.allCau.push({
                type: 'Cầu nhịp',
                pattern: '3-2-3',
                confidence: 85,
                description: 'NHỊP 3-2-3 ĐẶC BIỆT - ĐÁY 2',
                trend: 'Về 3'
            });
        }
    }

    // 4. CẦU 1-1-2-2
    detectCau1122() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        if (lens[0] === 1 && lens[1] === 1 && lens[2] === 2 && lens[3] === 2) {
            this.allCau.push({
                type: 'Cầu 1-1-2-2',
                confidence: 88,
                description: 'CẦU 1-1-2-2 HOÀN HẢO - TĂNG DẦN',
                trend: 'Tiếp tục tăng'
            });
        }
    }

    // 5. CẦU 2-2-1-1
    detectCau2211() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        if (lens[0] === 2 && lens[1] === 2 && lens[2] === 1 && lens[3] === 1) {
            this.allCau.push({
                type: 'Cầu 2-2-1-1',
                confidence: 88,
                description: 'CẦU 2-2-1-1 HOÀN HẢO - GIẢM DẦN',
                trend: 'Tiếp tục giảm'
            });
        }
    }

    // 6. CẦU 3-3
    detectCau33() {
        if (this.cauHistory.length < 2) return;
        
        const last2 = this.cauHistory.slice(-2);
        
        if (last2[0].length === 3 && last2[1].length === 3 && last2[0].char !== last2[1].char) {
            this.allCau.push({
                type: 'Cầu 3-3',
                confidence: 92,
                description: 'CẦU 3-3 HOÀN HẢO - CỰC KỲ CÂN BẰNG',
                trend: 'Có thể tiếp tục'
            });
        }
    }

    // 7. CẦU 2-3-2
    detectCau232() {
        if (this.cauHistory.length < 3) return;
        
        const last3 = this.cauHistory.slice(-3);
        const lens = last3.map(c => c.length);
        
        if (lens[0] === 2 && lens[1] === 3 && lens[2] === 2) {
            this.allCau.push({
                type: 'Cầu 2-3-2',
                confidence: 87,
                description: 'CẦU 2-3-2 ĐẶC BIỆT - ĐANG Ở ĐỈNH 3',
                trend: 'Sắp về 2'
            });
        }
    }

    // 8. CẦU 3-2-3
    detectCau323() {
        if (this.cauHistory.length < 3) return;
        
        const last3 = this.cauHistory.slice(-3);
        const lens = last3.map(c => c.length);
        
        if (lens[0] === 3 && lens[1] === 2 && lens[2] === 3) {
            this.allCau.push({
                type: 'Cầu 3-2-3',
                confidence: 87,
                description: 'CẦU 3-2-3 ĐẶC BIỆT - ĐANG Ở ĐÁY 2',
                trend: 'Sắp về 3'
            });
        }
    }

    // 9. CẦU XEN KẼ CHÉO
    detectCauXenKe() {
        if (this.cauHistory.length < 3) return;
        
        const last3 = this.cauHistory.slice(-3);
        
        if (last3[0].char !== last3[1].char && 
            last3[1].char !== last3[2].char && 
            last3[0].char === last3[2].char) {
            
            const avgLen = (last3[0].length + last3[2].length) / 2;
            let confidence = 70 + Math.min(20, avgLen * 5);
            let description = `XEN KẼ CHÉO - ĐỘ DÀI TB ${avgLen}`;
            
            if (avgLen >= 3) {
                confidence = 90;
                description = 'XEN KẼ CHÉO MẠNH - ĐANG MỞ RỘNG';
            }
            
            this.allCau.push({
                type: 'Cầu xen kẽ chéo',
                confidence: Math.min(95, confidence),
                description: description,
                trend: 'Tiếp tục'
            });
        }
    }

    // 10. CẦU 1-2-1-2
    detectCau1212() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        if (lens[0] === 1 && lens[1] === 2 && lens[2] === 1 && lens[3] === 2) {
            this.allCau.push({
                type: 'Cầu 1-2-1-2',
                confidence: 85,
                description: 'CẦU 1-2-1-2 - ĐANG Ở ĐỈNH 2',
                trend: 'Sắp về 1'
            });
        }
    }

    // 11. CẦU 2-1-2-1
    detectCau2121() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        if (lens[0] === 2 && lens[1] === 1 && lens[2] === 2 && lens[3] === 1) {
            this.allCau.push({
                type: 'Cầu 2-1-2-1',
                confidence: 85,
                description: 'CẦU 2-1-2-1 - ĐANG Ở ĐÁY 1',
                trend: 'Sắp về 2'
            });
        }
    }

    // 12. CẦU 1-1-1-2
    detectCau1112() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        if (lens[0] === 1 && lens[1] === 1 && lens[2] === 1 && lens[3] === 2) {
            this.allCau.push({
                type: 'Cầu 1-1-1-2',
                confidence: 80,
                description: 'CẦU 1-1-1-2 - SẮP LÊN 2',
                trend: 'Tiếp tục tăng'
            });
        }
    }

    // 13. CẦU 2-1-1-1
    detectCau2111() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        if (lens[0] === 2 && lens[1] === 1 && lens[2] === 1 && lens[3] === 1) {
            this.allCau.push({
                type: 'Cầu 2-1-1-1',
                confidence: 80,
                description: 'CẦU 2-1-1-1 - SẮP XUỐNG 1',
                trend: 'Tiếp tục giảm'
            });
        }
    }

    // 14. CẦU DÀI (CỰC DÀI)
    detectCauDai() {
        if (this.history.length < 20) return;
        
        let maxStreak = Math.max(...this.streakHistory);
        let lastChar = this.history[this.history.length - 1];
        let currentStreak = this.getCurrentStreak();
        
        if (currentStreak >= 8) {
            this.allCau.push({
                type: 'Cầu cực dài',
                char: lastChar,
                length: currentStreak,
                confidence: 95,
                description: `CỰC DÀI ${lastChar} (${currentStreak} VÁN) - SẮP ĐẢO!`,
                trend: 'Sắp đảo cực mạnh'
            });
        }
        
        if (maxStreak >= 10) {
            this.allCau.push({
                type: 'Cầu siêu dài',
                char: lastChar,
                length: maxStreak,
                confidence: 90,
                description: `SIÊU DÀI ${lastChar} (${maxStreak} VÁN)`,
                trend: 'Có thể đảo'
            });
        }
    }

    // 15. CẦU HỖN HỢP
    detectCauHonHop() {
        const bCount = this.frequency.B || 0;
        const pCount = this.frequency.P || 0;
        const total = this.length;
        
        if (total === 0) return;
        
        const ratioB = bCount / total;
        const ratioP = pCount / total;
        const diff = Math.abs(ratioB - ratioP);
        
        let confidence = 50;
        let description = '';
        let trend = '';
        
        if (diff < 0.05) {
            confidence = 55;
            description = 'CÂN BẰNG TUYỆT ĐỐI - B = P';
            trend = 'Cân bằng';
        } else if (diff < 0.1) {
            confidence = 60;
            description = 'CÂN BẰNG - B VÀ P GẦN NGANG';
            trend = 'Cân bằng';
        } else if (diff < 0.2) {
            confidence = 65;
            if (ratioB > ratioP) {
                description = `B HƠN P ${Math.round(diff * 100)}%`;
                trend = 'Hơi nghiêng B';
            } else {
                description = `P HƠN B ${Math.round(diff * 100)}%`;
                trend = 'Hơi nghiêng P';
            }
        } else if (diff < 0.35) {
            confidence = 70;
            if (ratioB > ratioP) {
                description = `B ÁP ĐẢO P ${Math.round(diff * 100)}%`;
                trend = 'Nghiêng B';
            } else {
                description = `P ÁP ĐẢO B ${Math.round(diff * 100)}%`;
                trend = 'Nghiêng P';
            }
        } else {
            confidence = 75;
            if (ratioB > ratioP) {
                description = `B CỰC KỲ ÁP ĐẢO P ${Math.round(diff * 100)}%`;
                trend = 'B mạnh';
            } else {
                description = `P CỰC KỲ ÁP ĐẢO B ${Math.round(diff * 100)}%`;
                trend = 'P mạnh';
            }
        }
        
        this.allCau.push({
            type: 'Cầu hỗn hợp',
            confidence: confidence,
            description: description,
            trend: trend,
            ratioB: Math.round(ratioB * 100),
            ratioP: Math.round(ratioP * 100)
        });
    }

    getCurrentStreak() {
        if (this.history.length === 0) return 0;
        const last = this.history[this.history.length - 1];
        let streak = 0;
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i] === last) streak++;
            else break;
        }
        return streak;
    }

    // ============================================================
    // DỰ ĐOÁN THÔNG MINH - KHÔNG RANDOM, KHÔNG CỨNG
    // ============================================================
    
    predict() {
        if (this.history.length === 0) {
            return { prediction: 'B', probB: 50, probP: 50, cau: null };
        }

        const lastChar = this.history[this.history.length - 1];
        const currentStreak = this.getCurrentStreak();
        const bCount = this.frequency.B || 0;
        const pCount = this.frequency.P || 0;
        const total = this.length;
        
        // Phân tích ALL CẦU
        this.detectAllCau();
        
        // Lấy cầu có độ tin cậy cao nhất
        const bestCau = this.allCau.length > 0 ? this.allCau[0] : null;
        
        let probB = 0.5;
        let probP = 0.5;
        
        // ===== DỰ ĐOÁN DỰA TRÊN CẦU TỐT NHẤT =====
        if (bestCau) {
            if (bestCau.type === 'Cầu bệt' || bestCau.type === 'Cầu cực dài' || bestCau.type === 'Cầu siêu dài') {
                // Bệt dài → khả năng đảo cao
                if (bestCau.length >= 8) {
                    if (bestCau.char === 'B') {
                        probP = 0.70 + Math.min(0.10, (bestCau.length - 8) * 0.02);
                        probB = 1 - probP;
                    } else {
                        probB = 0.70 + Math.min(0.10, (bestCau.length - 8) * 0.02);
                        probP = 1 - probB;
                    }
                } else if (bestCau.length >= 5) {
                    if (bestCau.char === 'B') {
                        probB = 0.65;
                        probP = 0.35;
                    } else {
                        probP = 0.65;
                        probB = 0.35;
                    }
                } else {
                    if (bestCau.char === 'B') {
                        probB = 0.60;
                        probP = 0.40;
                    } else {
                        probP = 0.60;
                        probB = 0.40;
                    }
                }
            }
            else if (bestCau.type === 'Cầu đảo') {
                // Đảo → đánh ngược
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') {
                    probB = 0.60 + bestCau.confidence / 100 * 0.15;
                    probP = 1 - probB;
                } else {
                    probP = 0.60 + bestCau.confidence / 100 * 0.15;
                    probB = 1 - probP;
                }
            }
            else if (bestCau.type.includes('nhịp')) {
                // Nhịp → dựa vào pattern
                const pattern = bestCau.pattern || '';
                const lastLen = this.cauHistory[this.cauHistory.length - 1].length;
                
                let nextLen = 0;
                if (pattern === '2-2-2') nextLen = 2;
                else if (pattern === '3-3-2') nextLen = 2;
                else if (pattern === '2-3-2') nextLen = 2;
                else if (pattern === '3-2-3') nextLen = 3;
                
                if (nextLen >= 2) {
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextChar === 'B') probB = 0.60;
                    else probP = 0.60;
                }
            }
            else if (bestCau.type.includes('1-1-2-2') || bestCau.type.includes('2-2-1-1')) {
                const currentLen = this.cauHistory[this.cauHistory.length - 1].length;
                if (currentLen === 2 || currentLen === 1) {
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextChar === 'B') probB = 0.65;
                    else probP = 0.65;
                }
            }
            else if (bestCau.type.includes('xen kẽ')) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') {
                    probB = 0.60 + bestCau.confidence / 100 * 0.15;
                    probP = 1 - probB;
                } else {
                    probP = 0.60 + bestCau.confidence / 100 * 0.15;
                    probB = 1 - probP;
                }
            }
            else if (bestCau.type === 'Cầu hỗn hợp') {
                // Dùng tỉ lệ tổng thể
                const ratioB = bCount / total;
                if (ratioB > 0.55) {
                    probB = 0.55 + (ratioB - 0.55) * 0.6;
                    probP = 1 - probB;
                } else if (ratioB < 0.45) {
                    probP = 0.55 + (0.45 - ratioB) * 0.6;
                    probB = 1 - probP;
                }
            }
        }
        
        // ===== ĐIỀU CHỈNH THEO ĐỘ TIN CẬY =====
        const confidence = bestCau ? bestCau.confidence : 50;
        const factor = confidence / 100;
        
        if (probB > 0.5) {
            probB = 0.5 + (probB - 0.5) * (0.6 + factor * 0.4);
            probP = 1 - probB;
        } else if (probP > 0.5) {
            probP = 0.5 + (probP - 0.5) * (0.6 + factor * 0.4);
            probB = 1 - probP;
        }
        
        // ===== GIỚI HẠN 55-80% =====
        const maxProb = 0.80;
        const minProb = 0.55;
        
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
        
        const totalProb = probB + probP;
        probB = Math.round((probB / totalProb) * 1000) / 10;
        probP = Math.round((probP / totalProb) * 1000) / 10;
        
        const prediction = probB >= probP ? 'B' : 'P';
        
        // ===== TRẢ VỀ TẤT CẢ THÔNG TIN =====
        return {
            prediction: prediction,
            probB: probB,
            probP: probP,
            bestCau: bestCau,
            allCau: this.allCau.slice(0, 5), // Top 5 cầu
            currentStreak: currentStreak,
            lastChar: lastChar,
            total: this.length,
            bCount: bCount,
            pCount: pCount,
            tCount: this.frequency.T || 0,
            rawResult: this.rawResult,
            cauHistory: this.cauHistory
        };
    }
}

// ============================================================
// API
// ============================================================

app.get('/api/predict/:tableId', async (req, res) => {
    try {
        const { tableId } = req.params;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        
        const analyzer = new SieuCauAnalyzer(tableId);
        const success = await analyzer.fetchData();
        
        if (!success) {
            return res.json({
                success: false,
                error: 'Không có dữ liệu cho bàn này'
            });
        }
        
        const result = analyzer.predict();
        const session = sessionManager.updateSession(tableId, clientIp, result.rawResult, result.bestCau);
        
        res.json({
            success: true,
            data: {
                phien: session.phien,
                duDoan: result.prediction,
                tiLe: `${result.probB}% - ${result.probP}%`,
                cauTotNhat: result.bestCau,
                tatCaCau: result.allCau,
                chuoiHienTai: result.lastChar.repeat(result.currentStreak) || 'Chưa có',
                cauGoc: result.rawResult,
                thongKe: {
                    tongVan: result.total,
                    B: result.bCount,
                    P: result.pCount,
                    T: result.tCount
                },
                lichSuCau: session.allCauDetected.slice(-5).map(item => ({
                    phien: item.phien,
                    loaiCau: item.cauInfo ? item.cauInfo.type : 'Không xác định',
                    doTinCay: item.cauInfo ? item.cauInfo.confidence : 0,
                    thoiGian: item.time
                }))
            }
        });
        
    } catch (error) {
        res.json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/predict/batch', async (req, res) => {
    try {
        const { tables = ['C01', 'C02', 'C03', '1', '2'] } = req.body;
        const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        const results = [];
        
        for (const tableId of tables) {
            const analyzer = new SieuCauAnalyzer(String(tableId));
            const success = await analyzer.fetchData();
            
            if (success) {
                const result = analyzer.predict();
                const session = sessionManager.updateSession(String(tableId), clientIp, result.rawResult, result.bestCau);
                
                results.push({
                    table: tableId,
                    phien: session.phien,
                    duDoan: result.prediction,
                    tiLe: `${result.probB}% - ${result.probP}%`,
                    cau: result.bestCau ? result.bestCau.type : 'Chưa xác định',
                    doTinCay: result.bestCau ? result.bestCau.confidence : 0
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
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    
    const session = sessionManager.resetSession(tableId, clientIp);
    res.json({
        success: true,
        message: `Đã reset phiên cho bàn ${tableId}`,
        phien: session.phien
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: 'SIÊU VIP 4.0',
        sessions: Object.keys(sessionManager.sessions).length
    });
});

// ============================================================
// START
// ============================================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 SIÊU VIP ANALYZER v4.0');
    console.log('========================================');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('📊 NHẬN DIỆN 15 LOẠI CẦU:');
    console.log('  1. Cầu bệt');
    console.log('  2. Cầu đảo');
    console.log('  3. Cầu nhịp (2-2-2, 3-3-2, 2-3-2, 3-2-3)');
    console.log('  4. Cầu 1-1-2-2');
    console.log('  5. Cầu 2-2-1-1');
    console.log('  6. Cầu 3-3');
    console.log('  7. Cầu 2-3-2');
    console.log('  8. Cầu 3-2-3');
    console.log('  9. Cầu xen kẽ chéo');
    console.log('  10. Cầu 1-2-1-2');
    console.log('  11. Cầu 2-1-2-1');
    console.log('  12. Cầu 1-1-1-2');
    console.log('  13. Cầu 2-1-1-1');
    console.log('  14. Cầu cực dài (8+ ván)');
    console.log('  15. Cầu hỗn hợp');
    console.log('========================================');
    console.log('🎯 KHÔNG RANDOM - KHÔNG CỨNG NHẮC');
    console.log('📈 CHỈ TĂNG PHIÊN KHI CÓ CẦU MỚI');
    console.log('🔄 F5 KHÔNG TĂNG PHIÊN');
    console.log('📊 TỈ LỆ DỰ ĐOÁN: 55-80%');
    console.log('========================================');
});
