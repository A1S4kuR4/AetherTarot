import { GoogleGenAI, Type } from "@google/genai";
import { TarotCard, Spread } from "../types";

const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export async function generateTarotInterpretation(
  question: string,
  spread: Spread,
  drawnCards: { positionName: string; card: TarotCard; isReversed: boolean }[]
) {
  const model = "gemini-3-flash-preview";
  
  const cardDetails = drawnCards.map(d => 
    `${d.positionName}: ${d.card.name} (${d.isReversed ? '逆位' : '正位'}) - ${d.card.description}`
  ).join('\n');

  const prompt = `
    你是一位专业的塔罗占卜师。
    用户的提问是: "${question}"
    使用的牌阵是: "${spread.name}"
    抽到的牌如下:
    ${cardDetails}

    请根据以上信息，提供深度的灵性解读。
    解读应包含以下部分：
    1. 启示之问：简要重述问题及其背后的能量。
    2. 符号解析：对每一张牌及其在牌阵中的位置进行详细分析。
    3. 能量连接：分析牌与牌之间的互动和整体能量流向。
    4. 最终合成：给出最终的建议和宇宙的指引。

    请使用富有诗意且专业的语言，符合“灵语塔罗”的神秘氛围。
    输出格式为 Markdown。
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return response.text || "宇宙的低语目前难以辨识，请稍后再试。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "连接星辰时发生了错误，请检查你的网络或稍后再试。";
  }
}
