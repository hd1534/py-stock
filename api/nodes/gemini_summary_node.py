import json
import os
import re
from typing import Optional
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field
from google import genai

from api.nodes.enums import NodeType
from api.nodes.base import BaseNode


class GeminiSummaryNodeInput(BaseModel):
    """링크 요약 입력 데이터"""
    url: str = Field(description="요약할 웹페이지 URL")
    summary_type: Optional[str] = Field(
        default="general", description="요약 타입 (general, detailed, bullet)")
    max_length: Optional[int] = Field(
        default=500, description="최대 요약 길이 (글자 수)")


class GeminiSummaryNodeOutput(BaseModel):
    """링크 요약 결과 출력 데이터"""
    title: str = Field(description="웹페이지 제목")
    url: str = Field(description="원본 URL")
    summary: str = Field(description="요약 내용")
    key_points: list[str] = Field(description="주요 포인트 목록")
    summary_type: str = Field(description="요약 타입")
    word_count: int = Field(description="요약 글자 수")
    success: bool = Field(description="요약 성공 여부")


class GeminiSummaryNode(BaseNode):
    """Google Gemini API를 사용한 웹페이지 요약 노드"""

    NODE_ID = "web_summary_gemini"
    NODE_NAME = "웹페이지 요약 (Gemini)"
    NODE_DESCRIPTION = "Google Gemini API를 사용하여 웹페이지 내용을 요약합니다"
    NODE_TYPE = NodeType.PROCESS
    NODE_CATEGORY = "ai"

    # 사용할 Pydantic 모델을 클래스에 연결
    INPUT_MODEL = GeminiSummaryNodeInput
    OUTPUT_MODEL = GeminiSummaryNodeOutput

    def _fetch_webpage_content(self, url: str) -> tuple[str, str]:
        """웹페이지 내용을 가져오는 함수"""
        # URL 검증
        parsed_url = urlparse(url)
        if not parsed_url.scheme or not parsed_url.netloc:
            raise ValueError("유효하지 않은 URL입니다.")

        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }

        try:
            response = requests.get(url, headers=headers, timeout=10)
            response.raise_for_status()
        except requests.RequestException as e:
            raise RuntimeError(f"웹페이지 접근 실패: {str(e)}")

        # BeautifulSoup으로 HTML 파싱
        soup = BeautifulSoup(response.content, 'html.parser')

        # 불필요한 태그 제거
        for tag in soup(['script', 'style', 'nav', 'header', 'footer', 'aside']):
            tag.decompose()

        # 제목 추출
        title = soup.find('title')
        title_text = title.get_text().strip() if title else "제목 없음"

        # 본문 내용 추출
        # 주요 콘텐츠 영역 찾기
        content_selectors = [
            'main', 'article', '.content', '.post', '.entry',
            '#content', '#main', '.main-content'
        ]

        content_text = ""
        for selector in content_selectors:
            content = soup.select_one(selector)
            if content:
                content_text = content.get_text()
                break

        # 메인 콘텐츠를 찾지 못한 경우 body 전체 사용
        if not content_text:
            body = soup.find('body')
            content_text = body.get_text() if body else soup.get_text()

        # 텍스트 정리
        content_text = re.sub(r'\s+', ' ', content_text).strip()

        if len(content_text) > 10000:  # 너무 긴 텍스트는 처음 10000자만 사용
            content_text = content_text[:10000] + "..."

        return title_text, content_text

    def execute(self, data: GeminiSummaryNodeInput) -> GeminiSummaryNodeOutput:
        """
        웹페이지 요약 로직 실행

        Args:
            data (GeminiSummaryNodeInput): 요약할 URL 데이터

        Returns:
            GeminiSummaryNodeOutput: 요약 결과
        """
        # API 키 설정
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("API 키가 설정되지 않았습니다. GEMINI_API_KEY 환경변수를 설정해주세요.")

        # 웹페이지 내용 가져오기
        title, content = self._fetch_webpage_content(data.url)

        if not content or len(content.strip()) < 50:
            raise ValueError("웹페이지에서 충분한 내용을 추출할 수 없습니다.")

        # 클라이언트 생성
        client = genai.Client(api_key=api_key)

        # 요약 타입에 따른 프롬프트 구성
        if data.summary_type == "detailed":
            summary_instruction = f"상세한 요약을 {data.max_length}자 내외로 작성해주세요."
        elif data.summary_type == "bullet":
            summary_instruction = f"주요 내용을 불릿 포인트 형태로 {data.max_length}자 내외로 작성해주세요."
        else:  # general
            summary_instruction = f"핵심 내용을 간결하게 {data.max_length}자 내외로 요약해주세요."

        # 프롬프트 구성
        prompt = f"""
다음 웹페이지 내용을 분석하고 요약해주세요.

**웹페이지 제목:** {title}
**URL:** {data.url}

**내용:**
```
{content}
```

**요청사항:**
1. {summary_instruction}
2. 주요 포인트 3-5개를 별도로 추출해주세요.
3. 객관적이고 정확한 정보만 포함해주세요.

응답은 반드시 다음 JSON 형식으로만 제공해주세요:
{{
    "summary": "요약 내용",
    "key_points": ["주요 포인트 1", "주요 포인트 2", "주요 포인트 3"]
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
            summary_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"JSON 파싱에 실패했습니다. 원시 응답: {response.text[:200]}...") from e

        summary_text = summary_data.get("summary", "요약을 생성할 수 없습니다.")
        key_points = summary_data.get("key_points", [])

        return GeminiSummaryNodeOutput(
            title=title,
            url=data.url,
            summary=summary_text,
            key_points=key_points,
            summary_type=data.summary_type,
            word_count=len(summary_text),
            success=True
        )


# --- 실행 예시 ---
if __name__ == "__main__":
    # 웹페이지 요약 노드 테스트
    summary_node = GeminiSummaryNode()

    print("\n--- 웹페이지 요약 노드 JSON 스키마 ---")
    node_info = summary_node.get_info()
    print(json.dumps(node_info, indent=2, ensure_ascii=False))

    # 실제 API 호출 테스트 (API 키가 있는 경우)
    if os.getenv('GEMINI_API_KEY'):
        print("\n--- 웹페이지 요약 API 호출 테스트 ---")
        test_data = {
            "url": "https://www.example.com",
            "summary_type": "general",
            "max_length": 300
        }
        try:
            result = summary_node.run(test_data)
            print(f"성공: {result.success}")
            if result.success:
                outputs = result.outputs
                print(f"제목: {outputs.get('title', '')}")
                print(f"요약: {outputs.get('summary', '')}")
                print(f"주요 포인트: {outputs.get('key_points', [])}")
                print(f"글자 수: {outputs.get('word_count', 0)}")
            else:
                print(f"오류: {result.error}")
        except Exception as e:
            print(f"테스트 중 오류 발생: {str(e)}")
    else:
        print("\n--- API 키가 설정되지 않아 실제 호출 테스트를 건너뜁니다 ---")
        print("GEMINI_API_KEY 환경변수를 설정해주세요.")
