import json
from typing import Type, Dict, Any

from pydantic import BaseModel, Field

from api.nodes.enums import NodeType
from api.nodes.base import BaseNode


class TestNodeInput(BaseModel):
    """TestNode의 입력 데이터를 위한 Pydantic 모델"""
    text_input: str = Field(description="텍스트 입력")
    number_input: int = Field(default=0, description="숫자 입력")


class TestNodeInput2(BaseModel):
    """TestNode의 입력 데이터를 위한 Pydantic 모델"""
    text1: str = Field(description="텍스트 입력")
    text2: str = Field(description="텍스트 입력")


class TestNodeOutput(BaseModel):
    """TestNode의 출력 데이터를 위한 Pydantic 모델"""
    processed_text: str = Field(description="처리된 텍스트")
    text_length: int = Field(description="텍스트 길이")


class TestNode(BaseNode):
    """테스트용 노드 예시 (Pydantic 적용)"""

    NODE_ID = "test_node"
    NODE_NAME = "테스트 노드"
    NODE_DESCRIPTION = "테스트용 노드입니다"
    NODE_TYPE = NodeType.PROCESS
    NODE_CATEGORY = "test"

    # 사용할 Pydantic 모델을 클래스에 연결
    INPUT_MODEL = TestNodeInput
    OUTPUT_MODEL = TestNodeOutput

    def execute(self, data: TestNodeInput) -> TestNodeOutput:
        """
        테스트 노드 실행 로직.
        타입 어노테이션을 통해 data가 TestNodeInput 객체임을 명시합니다.

        Args:
            data (TestNodeInput): 검증된 입력 데이터

        Returns:
            TestNodeOutput: 처리된 결과 데이터
        """
        # Pydantic 모델 객체의 속성으로 데이터에 접근 (훨씬 깔끔함)
        text = data.text_input
        number = data.number_input

        # 간단한 텍스트 처리
        processed = f"[{number}] {text.upper()}"
        length = len(text)

        # 출력 모델 객체를 생성하여 반환
        return TestNodeOutput(
            processed_text=processed,
            text_length=length
        )


class TestNode2(BaseNode):
    """테스트용 노드 예시 (Pydantic 적용)"""

    NODE_ID = "test_node_2"
    NODE_NAME = "테스트 노드 2"
    NODE_DESCRIPTION = "테스트용 노드 2입니다"
    NODE_TYPE = NodeType.PROCESS
    NODE_CATEGORY = "test"

    # 사용할 Pydantic 모델을 클래스에 연결
    INPUT_MODEL = TestNodeInput2
    OUTPUT_MODEL = TestNodeOutput

    def execute(self, data: TestNodeInput2) -> TestNodeOutput:
        """
        테스트 노드 실행 로직.
        타입 어노테이션을 통해 data가 TestNodeInput2 객체임을 명시합니다.

        Args:
            data (TestNodeInput2): 검증된 입력 데이터

        Returns:
            TestNodeOutput: 처리된 결과 데이터
        """
        # Pydantic 모델 객체의 속성으로 데이터에 접근 (훨씬 깔끔함)
        text1 = data.text1
        text2 = data.text2

        # 간단한 텍스트 처리
        processed = f"[{text1}] [{text2}]"
        length = len(processed)

        # 출력 모델 객체를 생성하여 반환
        return TestNodeOutput(
            processed_text=processed,
            text_length=length
        )


# --- 실행 예시 ---
if __name__ == "__main__":
    test_node = TestNode()

    # 0. 프론트엔드용 JSON 스키마
    node_info = test_node.get_info()
    print("\n--- 프론트엔드용 JSON 스키마 ---")
    print(json.dumps(node_info, indent=2, ensure_ascii=False))

    # 1. 성공 케이스
    print("--- 성공 케이스 ---")
    valid_data = {"text_input": "hello pydantic", "number_input": 123}
    result = test_node.run(valid_data)
    print(result.success)
    # 출력: True
    print(result.outputs)
    # 출력: {'processed_text': '[123] HELLO PYDANTIC', 'text_length': 14}

    # 2. 유효성 검사 실패 케이스 (필수 필드 누락)
    print("\n--- 실패 케이스 (필수 필드 누락) ---")
    missing_required_data = {"number_input": 456}
    result = test_node.run(missing_required_data)
    print(result.success)
    # 출력: False
    print(result.error)
    # 출력: Input validation failed: 1 validation error for TestNodeInput
    #       text_input
    #         Field required [type=missing, ...

    # 3. 유효성 검사 실패 케이스 (타입 불일치)
    print("\n--- 실패 케이스 (타입 불일치) ---")
    wrong_type_data = {"text_input": "some text",
                       "number_input": "not a number"}
    result = test_node.run(wrong_type_data)
    print(result.success)
    # 출력: False
    print(result.error)
    # 출력: Input validation failed: 1 validation error for TestNodeInput
    #       number_input
    #         Input should be a valid integer, unable to parse string as an integer ...
