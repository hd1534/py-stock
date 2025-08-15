from abc import ABC, abstractmethod
from typing import Type, Dict, Any, Optional

from pydantic import BaseModel, Field, ValidationError

from .enums import NodeType

# (NodeExecutionResult, NodeType 등 기존 클래스는 그대로 있다고 가정)


class NodeExecutionResult(BaseModel):
    """
    노드 실행 결과를 나타내는 Pydantic 모델.

    데이터 유효성 검사와 직렬화/역직렬화를 자동으로 처리합니다.
    """
    success: bool = Field(..., description="실행 성공 여부")
    outputs: Dict[str, Any] = Field(
        default_factory=dict, description="노드의 출력 데이터")
    error: Optional[str] = Field(default=None, description="에러 발생 시 메시지")


class BaseNode(ABC):
    """Pydantic 모델을 사용하여 입출력을 관리하는 모든 노드의 기본 클래스"""

    # 하위 클래스에서 반드시 정의해야 할 클래스 변수들
    NODE_ID: str = "BaseNode"
    NODE_NAME: str = "Base Node"
    NODE_DESCRIPTION: str = "Base node for all workflows"
    NODE_TYPE: NodeType = NodeType.UTILITY
    NODE_CATEGORY: str = "base"

    # Pydantic 모델을 클래스 변수로 지정
    INPUT_MODEL: Type[BaseModel]
    OUTPUT_MODEL: Type[BaseModel]

    def run(self, inputs: Dict[str, Any]) -> NodeExecutionResult:
        """
        입력 데이터를 Pydantic 모델로 검증하고 노드를 실행합니다.

        Args:
            inputs (Dict[str, Any]): 외부에서 주입된 JSON 데이터 (딕셔너리 형태)

        Returns:
            NodeExecutionResult: 노드 실행 결과
        """
        try:
            # 1. 입력 데이터 유효성 검사 및 모델 객체 생성
            validated_inputs = self.INPUT_MODEL.model_validate(inputs)

            # 2. 실제 노드 로직 실행
            result_model = self.execute(validated_inputs)

            # 3. 실행 결과가 올바른 출력 모델인지 확인
            if not isinstance(result_model, self.OUTPUT_MODEL):
                raise TypeError(
                    f"Execution result must be an instance of {self.OUTPUT_MODEL.__name__}")

            # 4. 성공 결과 반환
            return NodeExecutionResult(
                success=True,
                outputs=result_model.model_dump()  # 모델 객체를 다시 딕셔너리로 변환
            )

        except ValidationError as e:
            # Pydantic 유효성 검사 실패 시
            return NodeExecutionResult(
                success=False,
                error=f"Input validation failed: {e}"
            )
        except Exception as e:
            # 그 외 실행 중 에러 발생 시
            return NodeExecutionResult(
                success=False,
                error=f"Execution error: {str(e)}"
            )

    @abstractmethod
    def execute(self, data: BaseModel) -> BaseModel:
        """
        노드의 실제 실행 로직.
        검증된 Pydantic 입력 모델을 받아 Pydantic 출력 모델을 반환합니다.

        Args:
            data (BaseModel): 유효성 검사를 통과한 입력 데이터 모델 객체

        Returns:
            BaseModel: 노드 실행 결과 데이터 모델 객체
        """
        pass

    def get_info(self) -> Dict[str, Any]:
        """노드 정보와 함께 입출력 JSON 스키마를 반환합니다."""
        return {
            "id": self.NODE_ID,
            "name": self.NODE_NAME,
            "description": self.NODE_DESCRIPTION,
            "type": self.NODE_TYPE.value,
            "category": self.NODE_CATEGORY,
            # Pydantic 모델로부터 JSON 스키마 자동 생성
            "inputs": self.INPUT_MODEL.model_json_schema(),
            "outputs": self.OUTPUT_MODEL.model_json_schema()
        }
