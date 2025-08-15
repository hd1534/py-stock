import json
import os
import re
from typing import Optional
from urllib.parse import urlparse, parse_qs

from pydantic import BaseModel, Field
from google import genai

from api.nodes.enums import NodeType
from api.nodes.base import BaseNode


class YoutubeNodeInput(BaseModel):
    """유튜브 영상 요약 입력 데이터"""
    url: str = Field(description="요약할 유튜브 영상 URL")
    summary_type: Optional[str] = Field(
        default="general", description="요약 타입 (general, detailed, bullet)")
    max_length: Optional[int] = Field(
        default=500, description="최대 요약 길이 (글자 수)")


class YoutubeNodeOutput(BaseModel):
    """유튜브 영상 요약 결과 출력 데이터"""
    title: str = Field(description="영상 제목")
    url: str = Field(description="원본 URL")
    video_id: str = Field(description="유튜브 영상 ID")
    summary: str = Field(description="요약 내용")
    key_points: list[str] = Field(description="주요 포인트 목록")
    summary_type: str = Field(description="요약 타입")
    word_count: int = Field(description="요약 글자 수")
    success: bool = Field(description="요약 성공 여부")


class YoutubeNode(BaseNode):
    """Google Gemini API를 사용한 유튜브 영상 요약 노드"""

    NODE_ID = "youtube_summary_gemini"
    NODE_NAME = "유튜브 영상 요약 (Gemini)"
    NODE_DESCRIPTION = "Google Gemini API를 사용하여 유튜브 영상을 요약합니다"
    NODE_TYPE = NodeType.PROCESS
    NODE_CATEGORY = "ai"

    # 사용할 Pydantic 모델을 클래스에 연결
    INPUT_MODEL = YoutubeNodeInput
    OUTPUT_MODEL = YoutubeNodeOutput

    def _extract_video_id(self, url: str) -> str:
        """유튜브 URL에서 영상 ID를 추출하는 함수"""
        # 다양한 유튜브 URL 형식 지원
        patterns = [
            r'(?:https?://)?(?:www\.)?youtube\.com/watch\?v=([^&\n?#]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/embed/([^&\n?#]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/v/([^&\n?#]+)',
            r'(?:https?://)?youtu\.be/([^&\n?#]+)',
            r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([^&\n?#]+)'
        ]

        for pattern in patterns:
            match = re.search(pattern, url)
            if match:
                return match.group(1)

        raise ValueError("유효하지 않은 유튜브 URL입니다.")

    def execute(self, data: YoutubeNodeInput) -> YoutubeNodeOutput:
        """
        유튜브 영상 요약 로직 실행

        Args:
            data (YoutubeNodeInput): 요약할 유튜브 URL 데이터

        Returns:
            YoutubeNodeOutput: 요약 결과
        """
        # 유튜브 영상 ID 추출
        video_id = self._extract_video_id(data.url)

        # 클라이언트 생성
        client = genai.Client()

        # 요약 타입에 따른 프롬프트 구성
        if data.summary_type == "detailed":
            summary_instruction = f"상세한 요약을 {data.max_length}자 내외로 작성해주세요."
        elif data.summary_type == "bullet":
            summary_instruction = f"주요 내용을 불릿 포인트 형태로 {data.max_length}자 내외로 작성해주세요."
        else:  # general
            summary_instruction = f"핵심 내용을 간결하게 {data.max_length}자 내외로 요약해주세요."

        # 프롬프트 구성
        prompt_text = f"""
이 유튜브 영상을 분석하고 요약해주세요.

**요청사항:**
1. 영상의 제목과 주요 내용을 파악해주세요.
2. {summary_instruction}
3. 영상에서 언급되는 주요 포인트 3-5개를 별도로 추출해주세요.
4. 객관적이고 정확한 정보만 포함해주세요.

응답은 반드시 다음 JSON 형식으로만 제공해주세요:
{{
    "title": "영상 제목",
    "summary": "요약 내용",
    "key_points": ["주요 포인트 1", "주요 포인트 2", "주요 포인트 3"]
}}
"""

        # 파일 데이터 방식으로 API 호출
        response = client.models.generate_content(
            model='models/gemini-2.5-flash',
            contents=genai.types.Content(
                parts=[
                    genai.types.Part(
                        file_data=genai.types.FileData(file_uri=data.url),
                    ),
                    genai.types.Part(text=prompt_text)
                ]
            )
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
            video_data = json.loads(response_text)
        except json.JSONDecodeError as e:
            raise ValueError(
                f"JSON 파싱에 실패했습니다. 원시 응답: {response.text[:200]}...") from e

        title = video_data.get("title", "제목을 가져올 수 없습니다.")
        summary_text = video_data.get("summary", "요약을 생성할 수 없습니다.")
        key_points = video_data.get("key_points", [])

        return YoutubeNodeOutput(
            title=title,
            url=data.url,
            video_id=video_id,
            summary=summary_text,
            key_points=key_points,
            summary_type=data.summary_type,
            word_count=len(summary_text),
            success=True
        )


# --- 실행 예시 ---
if __name__ == "__main__":
    # 유튜브 영상 요약 노드 테스트
    youtube_node = YoutubeNode()

    print("\n--- 유튜브 영상 요약 노드 JSON 스키마 ---")
    node_info = youtube_node.get_info()
    print(json.dumps(node_info, indent=2, ensure_ascii=False))

    # 실제 API 호출 테스트 (API 키가 있는 경우)
    if os.getenv('GEMINI_API_KEY'):
        print("\n--- 유튜브 영상 요약 API 호출 테스트 ---")
        test_data = {
            "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # 예시 URL
            "summary_type": "general",
            "max_length": 300
        }
        try:
            result = youtube_node.run(test_data)
            print(f"성공: {result.success}")
            if result.success:
                outputs = result.outputs
                print(f"제목: {outputs.get('title', '')}")
                print(f"영상 ID: {outputs.get('video_id', '')}")
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
