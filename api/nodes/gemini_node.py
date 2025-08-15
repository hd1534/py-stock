import json
import os
from typing import Optional, List, Dict, Any

from pydantic import BaseModel, Field
from google import genai

from api.nodes.enums import NodeType
from api.nodes.base import BaseNode


class GeminiNodeInput(BaseModel):
    """간단한 주식 추천 입력 데이터"""
    data1: str = Field(description="첫 번째 분석 자료")
    data2: Optional[str] = Field(default="", description="두 번째 분석 자료")
    data3: Optional[str] = Field(default="", description="세 번째 분석 자료")


class GeminiNodeOutput(BaseModel):
    """주식 추천 결과 출력 데이터"""
    stock_name: str = Field(description="추천 주식 이름")
    stock_code: str = Field(description="주식 코드")
    reason: str = Field(description="추천 이유")
    current_price_krw: float = Field(description="현재가 (KRW)")
    target_price_krw: float = Field(description="목표가 (KRW)")
    stop_loss_krw: float = Field(description="손절가 (KRW)")
    investment_period: str = Field(description="권장 투자 기간")
    risk_level: str = Field(description="투자 위험도")
    additional_info: str = Field(description="기타 정보 및 주의사항")
    success: bool = Field(description="추천 성공 여부")


class GeminiNode(BaseNode):
    """Google Gemini API를 사용한 한국 주식 추천 노드"""

    NODE_ID = "stock_recommend_gemini"
    NODE_NAME = "주식 추천 (Gemini)"
    NODE_DESCRIPTION = "Google Gemini API를 사용하여 한국 주식을 분석하고 추천합니다"
    NODE_TYPE = NodeType.PROCESS
    NODE_CATEGORY = "ai"

    # 사용할 Pydantic 모델을 클래스에 연결
    INPUT_MODEL = GeminiNodeInput
    OUTPUT_MODEL = GeminiNodeOutput

    def execute(self, data: GeminiNodeInput) -> GeminiNodeOutput:
        """
        주식 추천 로직 실행

        Args:
            data (GeminiNodeInput): 분석 자료 데이터

        Returns:
            GeminiNodeOutput: 주식 추천 결과
        """
        # API 키 설정
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("API 키가 설정되지 않았습니다. GEMINI_API_KEY 환경변수를 설정해주세요.")

        # 클라이언트 생성
        client = genai.Client()

        # 프롬프트 구성
        prompt = f"""
당신은 한국 주식 시장 전문 애널리스트입니다.
아래 정보를 참고하고, 현재 이와 관련된 경제 정보등을 찾아본 뒤 주식을 추천해주세요.

**분석 자료 1:**
```
{data.data1}
```
**분석 자료 2:**
```
{data.data2}
```
**분석 자료 3:**
```
{data.data3}
```

**요구사항:**
1. 한국 주식 시장(KOSPI/KOSDAQ) 종목만 추천
2. 현실적인 가격 설정 
3. 구체적이고 논리적인 추천 이유 제시

응답은 반드시 다음 JSON 형식으로만 제공해주세요:
{{
    "stock_name": "회사명",
    "stock_code": "종목코드",
    "reason": "구체적인 추천 이유 (최소 100자)",
    "current_price_krw": 현재가격,
    "target_price_krw": 목표가격,
    "stop_loss_krw": 손절가격,
    "investment_period": "단기/중기/장기",
    "risk_level": "낮음/중간/높음",
    "additional_info": "주의사항 및 추가 정보"
}}
"""

        # API 호출
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=prompt
        )

        if not response.text:
            raise RuntimeError("Gemini API에서 응답을 받지 못했습니다.")

        # JSON 응답 파싱
        response_text = response.text.strip()

        # ```json으로 감싸진 경우 처리
        if "```json" in response_text:
            start = response_text.find("```json") + 7
            end = response_text.find("```", start)
            if end != -1:
                response_text = response_text[start:end].strip()
        elif "```" in response_text:
            start = response_text.find("```") + 3
            end = response_text.find("```", start)
            if end != -1:
                response_text = response_text[start:end].strip()

        try:
            # JSON 파싱
            stock_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"JSON 파싱에 실패했습니다. 원시 응답: {response.text[:200]}...") from e

        return GeminiNodeOutput(
            stock_name=stock_data.get("stock_name", "Unknown"),
            stock_code=stock_data.get("stock_code", "N/A"),
            reason=stock_data.get("reason", "이유 없음"),
            current_price_krw=float(stock_data.get("current_price_krw", 0)),
            target_price_krw=float(stock_data.get("target_price_krw", 0)),
            stop_loss_krw=float(stock_data.get("stop_loss_krw", 0)),
            investment_period=stock_data.get("investment_period", "N/A"),
            risk_level=stock_data.get("risk_level", "N/A"),
            additional_info=stock_data.get("additional_info", "추가 정보 없음"),
            success=True
        )


# --- 실행 예시 ---
if __name__ == "__main__":
    # 주식 추천 노드 테스트
    stock_node = GeminiNode()

    print("\n--- 주식 추천 노드 JSON 스키마 ---")
    node_info = stock_node.get_info()
    print(json.dumps(node_info, indent=2, ensure_ascii=False))

    # 실제 API 호출 테스트 (API 키가 있는 경우)
    if os.getenv('GEMINI_API_KEY'):
        print("\n--- 주식 추천 API 호출 테스트 ---")
        test_data = {
            "data1": "현재 한국 주식 시장은 반도체 업종이 강세를 보이고 있으며, 전기차 관련주들도 주목받고 있습니다.",
            "data2": "최근 삼성전자가 신규 반도체 공장 투자를 발표했고, SK하이닉스도 실적 개선 기대감이 높아지고 있습니다.",
            "data3": "투자 성향: 성장주 선호, 기술주 관심, 위험도: 중간, 예산: 100만원"
        }
        result = stock_node.run(test_data)
        print(f"성공: {result.success}")
        if result.success:
            outputs = result.outputs
            print(
                f"추천 주식: {outputs.get('stock_name', '')} ({outputs.get('stock_code', '')})")
            print(f"추천 이유: {outputs.get('reason', '')[:100]}...")
            print(f"현재가: {outputs.get('current_price_krw', 0):,} KRW")
            print(f"목표가: {outputs.get('target_price_krw', 0):,} KRW")
        else:
            print(f"오류: {result.error}")
    else:
        print("\n--- API 키가 설정되지 않아 실제 호출 테스트를 건너뜁니다 ---")
        print("GEMINI_API_KEY 환경변수를 설정해주세요.")
        print("예시: export GEMINI_API_KEY='your_api_key_here'")
