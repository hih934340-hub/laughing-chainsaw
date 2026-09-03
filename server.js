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
                lastResult: '',
                history: [],
                allCauDetected: []
            };
        }
        return this.sessions[key];
    }

    updateSession(tableId, clientIp, ketQuaMoi, cauInfo) {
        const session = this.getSession(tableId, clientIp);
        
        if (session.lastResult !== ketQuaMoi && ketQuaMoi) {
            session.phien += 1;
            session.lastResult = ketQuaMoi;
            
            session.history.push({
                phien: session.phien,
                ketQua: ketQuaMoi,
                time: new Date().toISOString()
            });
            
            if (cauInfo) {
                session.allCauDetected.push({
                    phien: session.phien,
                    cauInfo: cauInfo,
                    time: new Date().toISOString()
                });
            }
            
            if (session.history.length > 100) {
                session.history = session.history.slice(-100);
            }
            if (session.allCauDetected.length > 100) {
                session.allCauDetected = session.allCauDetected.slice(-100);
            }
        }
        
        return session;
    }

    resetSession(tableId, clientIp) {
        const key = `${tableId}_${clientIp}`;
        this.sessions[key] = {
            phien: 0,
            lastResult: '',
            history: [],
            allCauDetected: []
        };
        return this.sessions[key];
    }
}

const sessionManager = new SessionManager();

// ============================================================
// AI TỰ HỌC VÀ THÍCH NGHI
// ============================================================

class AdaptiveAI {
    constructor() {
        this.knowledgeBase = {
            patternWeights: {},
            accuracyHistory: [],
            adaptiveThreshold: 0.5,
            learningRate: 0.05,
            evolutionCount: 0,
            lastPrediction: null,
            lastResult: null,
            confidenceMap: {}
        };
    }

    learn(actualResult, predictedResult, pattern) {
        const isCorrect = actualResult === predictedResult;
        
        this.knowledgeBase.accuracyHistory.push({
            time: new Date().toISOString(),
            isCorrect,
            actualResult,
            predictedResult,
            pattern
        });
        
        if (this.knowledgeBase.accuracyHistory.length > 200) {
            this.knowledgeBase.accuracyHistory = this.knowledgeBase.accuracyHistory.slice(-200);
        }
        
        const accuracy = this.getAccuracy();
        
        if (accuracy > 0.6) {
            this.knowledgeBase.adaptiveThreshold += this.knowledgeBase.learningRate;
            this.knowledgeBase.evolutionCount++;
        } else if (accuracy < 0.4) {
            this.knowledgeBase.adaptiveThreshold -= this.knowledgeBase.learningRate;
            this.knowledgeBase.evolutionCount++;
        }
        
        if (pattern) {
            if (!this.knowledgeBase.patternWeights[pattern]) {
                this.knowledgeBase.patternWeights[pattern] = 1;
            }
            this.knowledgeBase.patternWeights[pattern] *= isCorrect ? 1.15 : 0.85;
        }
        
        if (!this.knowledgeBase.confidenceMap[pattern]) {
            this.knowledgeBase.confidenceMap[pattern] = {
                total: 0,
                correct: 0
            };
        }
        this.knowledgeBase.confidenceMap[pattern].total++;
        if (isCorrect) {
            this.knowledgeBase.confidenceMap[pattern].correct++;
        }
    }

    getAccuracy() {
        if (this.knowledgeBase.accuracyHistory.length === 0) return 0.5;
        const correct = this.knowledgeBase.accuracyHistory.filter(h => h.isCorrect).length;
        return correct / this.knowledgeBase.accuracyHistory.length;
    }

    getPatternConfidence(pattern) {
        const data = this.knowledgeBase.confidenceMap[pattern];
        if (!data || data.total === 0) return 0.5;
        return data.correct / data.total;
    }

    getPatternWeight(pattern) {
        return this.knowledgeBase.patternWeights[pattern] || 1;
    }

    adjustPrediction(probB, probP, pattern) {
        const accuracy = this.getAccuracy();
        const patternConfidence = this.getPatternConfidence(pattern);
        const patternWeight = this.getPatternWeight(pattern);
        
        let adjustedProbB = probB;
        let adjustedProbP = probP;
        
        const accuracyFactor = Math.min(0.25, Math.abs(accuracy - 0.5) * 0.5);
        const patternFactor = Math.min(0.15, Math.abs(patternConfidence - 0.5) * 0.3);
        const weightFactor = Math.min(0.1, Math.abs(patternWeight - 1) * 0.05);
        
        if (accuracy > 0.55) {
            adjustedProbB *= (1 + accuracyFactor) / (1 - accuracyFactor);
            adjustedProbP *= (1 - accuracyFactor) / (1 + accuracyFactor);
        } else if (accuracy < 0.45) {
            adjustedProbB *= (1 - accuracyFactor) / (1 + accuracyFactor);
            adjustedProbP *= (1 + accuracyFactor) / (1 - accuracyFactor);
        }
        
        if (patternConfidence > 0.55) {
            adjustedProbB *= (1 + patternFactor) / (1 - patternFactor);
            adjustedProbP *= (1 - patternFactor) / (1 + patternFactor);
        } else if (patternConfidence < 0.45) {
            adjustedProbB *= (1 - patternFactor) / (1 + patternFactor);
            adjustedProbP *= (1 + patternFactor) / (1 - patternFactor);
        }
        
        if (patternWeight > 1.1) {
            adjustedProbB *= (1 + weightFactor) / (1 - weightFactor);
            adjustedProbP *= (1 - weightFactor) / (1 + weightFactor);
        } else if (patternWeight < 0.9) {
            adjustedProbB *= (1 - weightFactor) / (1 + weightFactor);
            adjustedProbP *= (1 + weightFactor) / (1 - weightFactor);
        }
        
        const total = adjustedProbB + adjustedProbP;
        adjustedProbB = adjustedProbB / total;
        adjustedProbP = adjustedProbP / total;
        
        return {
            probB: Math.round(adjustedProbB * 1000) / 10,
            probP: Math.round(adjustedProbP * 1000) / 10,
            accuracy: Math.round(accuracy * 100),
            patternConfidence: Math.round(patternConfidence * 100),
            evolution: this.knowledgeBase.evolutionCount
        };
    }
}

const adaptiveAI = new AdaptiveAI();

// ============================================================
// PHÂN TÍCH CẦU SIÊU VIP - NHẬN DIỆN NHANH MẠNH CHUẨN
// ============================================================

class SieuCauAnalyzer {
    constructor(tableId) {
        this.tableId = tableId;
        this.rawResult = '';
        this.history = [];
        this.length = 0;
        this.ketQuaMoiNhat = '';
        this.cauHistory = [];
        this.streakHistory = [];
        this.frequency = { B: 0, P: 0, T: 0 };
        this.matrix = { B: { B: 0, P: 0, T: 0 }, P: { B: 0, P: 0, T: 0 }, T: { B: 0, P: 0, T: 0 } };
        this.positions = { B: [], P: [], T: [] };
        this.patterns = {};
        this.allCau = [];
        this.statistics = {};
    }

    async fetchData() {
        try {
            const url = `https://symmetrical-carnival-d111.onrender.com/api/baccarat/${this.tableId}`;
            const response = await axios.get(url, { timeout: 10000 });
            
            if (response.data && response.data.success) {
                this.rawResult = response.data.data.result || response.data.data.rawResult || '';
                
                if (!this.rawResult) {
                    console.error('API không trả về result');
                    return false;
                }
                
                this.history = this.rawResult.split('');
                this.length = this.history.length;
                this.ketQuaMoiNhat = this.history[this.history.length - 1] || '';
                
                this.buildAll();
                return true;
            } else {
                console.error('API trả về success = false');
                return false;
            }
        } catch (error) {
            console.error('Lỗi fetch data:', error.message);
            return false;
        }
    }

    buildAll() {
        this.buildCauHistory();
        this.buildFrequency();
        this.buildMatrix();
        this.buildPositions();
        this.buildPatterns();
        this.buildStatistics();
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
        this.matrix = { B: { B: 0, P: 0, T: 0 }, P: { B: 0, P: 0, T: 0 }, T: { B: 0, P: 0, T: 0 } };
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
        for (let size = 2; size <= 10; size++) {
            this.patterns[size] = {};
            for (let i = 0; i <= this.history.length - size; i++) {
                const pattern = this.history.slice(i, i + size).join('');
                this.patterns[size][pattern] = (this.patterns[size][pattern] || 0) + 1;
            }
        }
    }

    buildStatistics() {
        this.statistics = {
            totalVan: this.length,
            tongB: this.frequency.B || 0,
            tongP: this.frequency.P || 0,
            tongT: this.frequency.T || 0,
            tyLeB: this.length > 0 ? Math.round((this.frequency.B || 0) / this.length * 100) : 0,
            tyLeP: this.length > 0 ? Math.round((this.frequency.P || 0) / this.length * 100) : 0,
            tyLeT: this.length > 0 ? Math.round((this.frequency.T || 0) / this.length * 100) : 0,
            streakHienTai: this.getCurrentStreak(),
            streakMax: Math.max(...this.streakHistory, 0),
            cauCount: this.cauHistory.length,
            avgStreak: this.streakHistory.length > 0 ? 
                Math.round(this.streakHistory.reduce((a, b) => a + b, 0) / this.streakHistory.length * 10) / 10 : 0
        };
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
    // NHẬN DIỆN TẤT CẢ CÁC LOẠI CẦU (20 LOẠI)
    // ============================================================
    
    detectAllCau() {
        this.allCau = [];
        
        this.detectCauBet();
        this.detectCauDao();
        this.detectCauNhip();
        this.detectCau1122();
        this.detectCau2211();
        this.detectCau33();
        this.detectCau232();
        this.detectCau323();
        this.detectCauXenKe();
        this.detectCau1212();
        this.detectCau2121();
        this.detectCau1112();
        this.detectCau2111();
        this.detectCauDai();
        this.detectCauHonHop();
        this.detectCauNgan();
        this.detectCauTrungBinh();
        this.detectCauBatThuong();
        this.detectCauChuKy();
        this.detectCauXuHuong();
        
        this.allCau.sort((a, b) => b.confidence - a.confidence);
    }

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
            let trend = '';
            
            if (totalLen >= 12) {
                confidence = 95;
                description = `BỆT SIÊU DÀI ${last.char} (${totalLen} VÁN) - CỰC KỲ NGUY HIỂM!`;
                trend = 'Đảo cực mạnh';
            } else if (totalLen >= 10) {
                confidence = 90;
                description = `BỆT SIÊU DÀI ${last.char} (${totalLen} VÁN) - SẮP ĐẢO!`;
                trend = 'Sắp đảo';
            } else if (totalLen >= 7) {
                confidence = 80;
                description = `BỆT DÀI ${last.char} (${totalLen} VÁN) - CẨN THẬN ĐẢO`;
                trend = 'Cẩn thận đảo';
            } else if (totalLen >= 5) {
                confidence = 70;
                description = `BỆT ${last.char} (${totalLen} VÁN) - ĐANG MẠNH`;
                trend = 'Tiếp tục';
            } else if (totalLen >= 3) {
                confidence = 60;
                description = `BỆT ${last.char} (${totalLen} VÁN) - ĐANG HÌNH THÀNH`;
                trend = 'Tiếp tục';
            } else {
                confidence = 50;
                description = `BỆT NHỎ ${last.char} (${totalLen} VÁN)`;
                trend = 'Tiếp tục';
            }
            
            this.allCau.push({
                type: 'Cầu bệt',
                char: last.char,
                length: totalLen,
                confidence: confidence,
                description: description,
                trend: trend
            });
        }
    }

    detectCauDao() {
        if (this.cauHistory.length < 4) return;
        
        const last = this.cauHistory.slice(-6);
        let isDao = true;
        let daoCount = 0;
        
        for (let i = 0; i < last.length - 1; i++) {
            if (last[i].char === last[i+1].char) {
                isDao = false;
                break;
            }
            daoCount++;
        }
        
        if (daoCount >= 3) {
            let totalLen = last.reduce((sum, c) => sum + c.length, 0);
            let confidence = 50 + daoCount * 8;
            let description = `ĐẢO ${daoCount} LẦN ${last.slice(0, daoCount + 1).map(c => c.char).join('')}`;
            
            if (daoCount >= 5) {
                confidence = 90;
                description = `ĐẢO SIÊU DÀI ${last.map(c => c.char).join('')}`;
            } else if (daoCount >= 4) {
                confidence = 80;
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

    detectCauNhip() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const chars = last4.map(c => c.char);
        const lens = last4.map(c => c.length);
        
        // Kiểm tra các pattern nhịp
        const patterns = [
            { lens: [2, 2, 2], confidence: 80, description: 'NHỊP 2-2-2 ĐỀU' },
            { lens: [3, 3, 2], confidence: 78, description: 'NHỊP 3-3-2 - ĐANG GIẢM' },
            { lens: [2, 3, 2], confidence: 85, description: 'NHỊP 2-3-2 ĐẶC BIỆT' },
            { lens: [3, 2, 3], confidence: 85, description: 'NHỊP 3-2-3 ĐẶC BIỆT' },
            { lens: [1, 2, 1], confidence: 70, description: 'NHỊP 1-2-1' },
            { lens: [2, 1, 2], confidence: 70, description: 'NHỊP 2-1-2' },
            { lens: [3, 3, 3], confidence: 82, description: 'NHỊP 3-3-3 ĐỀU' },
            { lens: [4, 4, 4], confidence: 85, description: 'NHỊP 4-4-4 ĐỀU' }
        ];
        
        for (const pattern of patterns) {
            if (lens[0] === pattern.lens[0] && lens[1] === pattern.lens[1] && lens[2] === pattern.lens[2]) {
                if (chars[0] !== chars[1] && chars[1] !== chars[2]) {
                    this.allCau.push({
                        type: 'Cầu nhịp',
                        pattern: pattern.lens.join('-'),
                        confidence: pattern.confidence,
                        description: pattern.description,
                        trend: 'Tiếp tục nhịp'
                    });
                    break;
                }
            }
        }
    }

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

    detectCauNgan() {
        if (this.cauHistory.length < 5) return;
        
        const last5 = this.cauHistory.slice(-5);
        const allShort = last5.every(c => c.length <= 2);
        
        if (allShort) {
            this.allCau.push({
                type: 'Cầu ngắn',
                confidence: 65,
                description: 'CẦU NGẮN - NHIỀU LẦN ĐỔI',
                trend: 'Tiếp tục ngắn'
            });
        }
    }

    detectCauTrungBinh() {
        if (this.cauHistory.length < 3) return;
        
        const last3 = this.cauHistory.slice(-3);
        const avgLen = last3.reduce((sum, c) => sum + c.length, 0) / 3;
        
        if (avgLen >= 2 && avgLen <= 4) {
            this.allCau.push({
                type: 'Cầu trung bình',
                confidence: 70,
                description: `CẦU TRUNG BÌNH - ĐỘ DÀI TB ${avgLen.toFixed(1)}`,
                trend: 'Ổn định'
            });
        }
    }

    detectCauBatThuong() {
        if (this.cauHistory.length < 3) return;
        
        const last3 = this.cauHistory.slice(-3);
        const lens = last3.map(c => c.length);
        const maxLen = Math.max(...lens);
        const minLen = Math.min(...lens);
        
        if (maxLen - minLen >= 5) {
            this.allCau.push({
                type: 'Cầu bất thường',
                confidence: 60,
                description: `CẦU BẤT THƯỜNG - BIẾN ĐỘNG LỚN (${minLen}-${maxLen})`,
                trend: 'Khó đoán'
            });
        }
    }

    detectCauChuKy() {
        if (this.cauHistory.length < 6) return;
        
        const last6 = this.cauHistory.slice(-6);
        const first3 = last6.slice(0, 3).map(c => c.length);
        const last3 = last6.slice(3, 6).map(c => c.length);
        
        let isChuKy = true;
        for (let i = 0; i < 3; i++) {
            if (first3[i] !== last3[i]) {
                isChuKy = false;
                break;
            }
        }
        
        if (isChuKy) {
            this.allCau.push({
                type: 'Cầu chu kỳ',
                confidence: 85,
                description: `CẦU CHU KỲ - LẶP LẠI ${first3.join('-')}`,
                trend: 'Tiếp tục chu kỳ'
            });
        }
    }

    detectCauXuHuong() {
        if (this.cauHistory.length < 4) return;
        
        const last4 = this.cauHistory.slice(-4);
        const lens = last4.map(c => c.length);
        
        let isTang = true;
        let isGiam = true;
        
        for (let i = 1; i < lens.length; i++) {
            if (lens[i] <= lens[i-1]) isTang = false;
            if (lens[i] >= lens[i-1]) isGiam = false;
        }
        
        if (isTang) {
            this.allCau.push({
                type: 'Cầu xu hướng',
                confidence: 75,
                description: 'XU HƯỚNG TĂNG DẦN',
                trend: 'Tiếp tục tăng'
            });
        } else if (isGiam) {
            this.allCau.push({
                type: 'Cầu xu hướng',
                confidence: 75,
                description: 'XU HƯỚNG GIẢM DẦN',
                trend: 'Tiếp tục giảm'
            });
        }
    }

    predict() {
        if (this.history.length === 0) {
            return { prediction: 'B', probB: 50, probP: 50 };
        }

        const lastChar = this.ketQuaMoiNhat;
        const currentStreak = this.getCurrentStreak();
        const bCount = this.frequency.B || 0;
        const pCount = this.frequency.P || 0;
        const total = this.length;
        
        this.detectAllCau();
        
        const bestCau = this.allCau.length > 0 ? this.allCau[0] : null;
        
        let probB = 0.5;
        let probP = 0.5;
        
        if (bestCau) {
            if (bestCau.type === 'Cầu bệt' || bestCau.type === 'Cầu cực dài' || bestCau.type === 'Cầu siêu dài') {
                if (bestCau.length >= 8) {
                    if (bestCau.char === 'B') {
                        probP = 0.70 + Math.min(0.15, (bestCau.length - 8) * 0.03);
                        probB = 1 - probP;
                    } else {
                        probB = 0.70 + Math.min(0.15, (bestCau.length - 8) * 0.03);
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
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') {
                    probB = 0.60 + bestCau.confidence / 100 * 0.2;
                    probP = 1 - probB;
                } else {
                    probP = 0.60 + bestCau.confidence / 100 * 0.2;
                    probB = 1 - probP;
                }
            }
            else if (bestCau.type.includes('nhịp') || bestCau.type.includes('chu kỳ')) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.62;
                else probP = 0.62;
            }
            else if (bestCau.type.includes('1-1-2-2') || bestCau.type.includes('2-2-1-1') || 
                     bestCau.type.includes('1-2-1-2') || bestCau.type.includes('2-1-2-1') ||
                     bestCau.type.includes('1-1-1-2') || bestCau.type.includes('2-1-1-1')) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.65;
                else probP = 0.65;
            }
            else if (bestCau.type.includes('xen kẽ')) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') {
                    probB = 0.60 + bestCau.confidence / 100 * 0.2;
                    probP = 1 - probB;
                } else {
                    probP = 0.60 + bestCau.confidence / 100 * 0.2;
                    probB = 1 - probP;
                }
            }
            else if (bestCau.type === 'Cầu hỗn hợp') {
                const ratioB = bCount / total;
                if (ratioB > 0.55) {
                    probB = 0.55 + (ratioB - 0.55) * 0.6;
                    probP = 1 - probB;
                } else if (ratioB < 0.45) {
                    probP = 0.55 + (0.45 - ratioB) * 0.6;
                    probB = 1 - probP;
                }
            }
            else if (bestCau.type.includes('3-3') || bestCau.type.includes('2-3-2') || bestCau.type.includes('3-2-3')) {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.62;
                else probP = 0.62;
            }
            else if (bestCau.type === 'Cầu ngắn') {
                const nextChar = lastChar === 'B' ? 'P' : 'B';
                if (nextChar === 'B') probB = 0.58;
                else probP = 0.58;
            }
            else if (bestCau.type === 'Cầu xu hướng') {
                if (bestCau.trend === 'Tiếp tục tăng') {
                    if (lastChar === 'B') probB = 0.60;
                    else probP = 0.60;
                } else {
                    const nextChar = lastChar === 'B' ? 'P' : 'B';
                    if (nextChar === 'B') probB = 0.60;
                    else probP = 0.60;
                }
            }
        }
        
        // Điều chỉnh theo ma trận Markov
        if (this.matrix[lastChar]) {
            const totalNext = (this.matrix[lastChar].B || 0) + (this.matrix[lastChar].P || 0);
            if (totalNext > 0) {
                const markovB = (this.matrix[lastChar].B || 0) / totalNext;
                const markovP = (this.matrix[lastChar].P || 0) / totalNext;
                
                probB = probB * 0.7 + markovB * 0.3;
                probP = probP * 0.7 + markovP * 0.3;
            }
        }
        
        // Điều chỉnh theo độ tin cậy
        const confidence = bestCau ? bestCau.confidence : 50;
        const factor = confidence / 100;
        
        if (probB > 0.5) {
            probB = 0.5 + (probB - 0.5) * (0.6 + factor * 0.4);
            probP = 1 - probB;
        } else if (probP > 0.5) {
            probP = 0.5 + (probP - 0.5) * (0.6 + factor * 0.4);
            probB = 1 - probP;
        }
        
        // Áp dụng AI thích nghi
        const pattern = bestCau ? bestCau.type : 'unknown';
        const aiAdjusted = adaptiveAI.adjustPrediction(probB, probP, pattern);
        
        let finalProbB = (aiAdjusted.probB + probB * 100) / 2;
        let finalProbP = (aiAdjusted.probP + probP * 100) / 2;
        
        const totalProb = finalProbB + finalProbP;
        finalProbB = Math.round((finalProbB / totalProb) * 1000) / 10;
        finalProbP = Math.round((finalProbP / totalProb) * 1000) / 10;
        
        const prediction = finalProbB >= finalProbP ? 'B' : 'P';
        
        return {
            prediction: prediction,
            probB: finalProbB,
            probP: finalProbP,
            bestCau: bestCau,
            allCau: this.allCau.slice(0, 10),
            currentStreak: currentStreak,
            ketQuaMoiNhat: this.ketQuaMoiNhat,
            total: total,
            bCount: bCount,
            pCount: pCount,
            tCount: this.frequency.T || 0,
            rawResult: this.rawResult,
            cauHistory: this.cauHistory,
            statistics: this.statistics,
            aiInfo: {
                accuracy: aiAdjusted.accuracy,
                patternConfidence: aiAdjusted.patternConfidence,
                evolution: aiAdjusted.evolution
            }
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
                error: 'Không lấy được dữ liệu từ API'
            });
        }
        
        const result = analyzer.predict();
        const session = sessionManager.updateSession(tableId, clientIp, result.ketQuaMoiNhat, result.bestCau);
        
        res.json({
            success: true,
            data: {
                phien: session.phien,
                ketQua: result.ketQuaMoiNhat,
                phienDuDoan: session.phien + 1,
                duDoan: result.prediction,
                tiLe: `${result.probB}% - ${result.probP}%`,
                cauTotNhat: result.bestCau,
                tatCaCau: result.allCau,
                thongKe: result.statistics,
                aiInfo: result.aiInfo
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
                const session = sessionManager.updateSession(String(tableId), clientIp, result.ketQuaMoiNhat, result.bestCau);
                
                results.push({
                    table: tableId,
                    phien: session.phien,
                    ketQua: result.ketQuaMoiNhat,
                    phienDuDoan: session.phien + 1,
                    duDoan: result.prediction,
                    tiLe: `${result.probB}% - ${result.probP}%`,
                    cauTotNhat: result.bestCau,
                    thongKe: result.statistics,
                    aiInfo: result.aiInfo
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

app.post('/api/learn', (req, res) => {
    const { actualResult, predictedResult, pattern } = req.body;
    if (actualResult && predictedResult) {
        adaptiveAI.learn(actualResult, predictedResult, pattern);
        res.json({
            success: true,
            message: 'AI đã học từ kết quả',
            accuracy: `${Math.round(adaptiveAI.getAccuracy() * 100)}%`,
            evolution: adaptiveAI.knowledgeBase.evolutionCount
        });
    } else {
        res.json({
            success: false,
            error: 'Thiếu dữ liệu học'
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

app.get('/api/sessions', (req, res) => {
    res.json({
        success: true,
        data: sessionManager.sessions
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: 'SIÊU VIP ULTIMATE',
        sessions: Object.keys(sessionManager.sessions).length,
        aiAccuracy: `${Math.round(adaptiveAI.getAccuracy() * 100)}%`,
        aiEvolution: adaptiveAI.knowledgeBase.evolutionCount
    });
});

// ============================================================
// START
// ============================================================

app.listen(PORT, () => {
    console.log('========================================');
    console.log('🚀 SIÊU VIP ANALYZER ULTIMATE');
    console.log('========================================');
    console.log(`📡 Server: http://localhost:${PORT}`);
    console.log('📊 NHẬN DIỆN 20 LOẠI CẦU');
    console.log('🎯 KHÔNG RANDOM - KHÔNG CỨNG NHẮC');
    console.log('🤖 AI TỰ HỌC VÀ THÍCH NGHI');
    console.log('📈 MA TRẬN MARKOV');
    console.log('🧠 PHÂN TÍCH THÔNG MINH');
    console.log('🔄 F5 KHÔNG TĂNG PHIÊN');
    console.log('📊 KẾT QUẢ: B, P, HOẶC T');
    console.log('========================================');
});
