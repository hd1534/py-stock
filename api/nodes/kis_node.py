import json
import os
from pathlib import Path
from typing import Type, Dict, Any

from pydantic import BaseModel, Field
import pandas as pd

from api.functions import kis_auth as ka
from api.nodes.enums import NodeType
from api.nodes.base import BaseNode
from api.functions.domestic_stock_functions import order_cash
from api.data.kis_code import get_kosdaq_master_dataframe, get_kospi_master_dataframe

# 전역 변수로 DataFrame 초기화 (None으로 시작)
KOSPI_DF = None
KOSDAQ_DF = None


def load_stock_data():
    """주식 데이터를 로드하는 함수"""
    global KOSPI_DF, KOSDAQ_DF

    if KOSPI_DF is None or KOSDAQ_DF is None:
        try:
            kospi_path = Path('api/data/kospi_code.mst')
            kosdaq_path = Path('api/data/kosdaq_code.mst')

            if kospi_path.exists() and kosdaq_path.exists():
                KOSPI_DF = get_kospi_master_dataframe(str(kospi_path.parent))
                KOSDAQ_DF = get_kosdaq_master_dataframe(
                    str(kosdaq_path.parent))
            else:
                # 파일이 없으면 빈 DataFrame으로 초기화
                KOSPI_DF = pd.DataFrame(columns=['단축코드', '한글명'])
                KOSDAQ_DF = pd.DataFrame(columns=['단축코드', '한글종목명'])
        except Exception as e:
            # 에러 발생시 빈 DataFrame으로 초기화
            KOSPI_DF = pd.DataFrame(columns=['단축코드', '한글명'])
            KOSDAQ_DF = pd.DataFrame(columns=['단축코드', '한글종목명'])


def find_stock_code(stock_name: str) -> str:
    """주식 이름으로 종목 코드를 찾는 함수"""
    load_stock_data()

    # KOSPI에서 먼저 검색
    kospi_matches = KOSPI_DF[KOSPI_DF['한글명'].str.contains(
        stock_name, na=False)]
    if not kospi_matches.empty:
        return kospi_matches.iloc[0]['단축코드']

    # KOSDAQ에서 검색
    kosdaq_matches = KOSDAQ_DF[KOSDAQ_DF['한글종목명'].str.contains(
        stock_name, na=False)]
    if not kosdaq_matches.empty:
        return kosdaq_matches.iloc[0]['단축코드']

    return None


class StockBuyNodeInput(BaseModel):
    """StockBuyNode의 입력 데이터를 위한 Pydantic 모델"""
    stock_name: str = Field(description="주식 이름")
    quantity: int = Field(default=1, description="매수 수량")


class StockBuyNodeOutput(BaseModel):
    """StockBuyNode의 출력 데이터를 위한 Pydantic 모델"""
    success: bool = Field(description="주문 성공 여부")
    order_id: str = Field(default="", description="주문번호")
    stock_name: str = Field(description="주식 이름")
    stock_code: str = Field(description="종목 코드")
    quantity: int = Field(description="주문 수량")
    order_price: str = Field(default="", description="주문 가격")
    message: str = Field(description="결과 메시지")
    order_time: str = Field(default="", description="주문 시간")


class StockBuyNode(BaseNode):
    """주식 매수 노드 예시 (Pydantic 적용)"""

    NODE_ID = "stock_buy_node"
    NODE_NAME = "주식 매수 노드"
    NODE_DESCRIPTION = "주식 매수 노드입니다"
    NODE_TYPE = NodeType.PROCESS
    NODE_CATEGORY = "test"

    # 사용할 Pydantic 모델을 클래스에 연결
    INPUT_MODEL = StockBuyNodeInput
    OUTPUT_MODEL = StockBuyNodeOutput

    def execute(self, data: StockBuyNodeInput) -> StockBuyNodeOutput:
        """
        주식 매수 노드 실행 로직.

        Args:
            data (StockBuyNodeInput): 검증된 입력 데이터

        Returns:
            StockBuyNodeOutput: 처리된 결과 데이터
        """
        stock_name = data.stock_name
        quantity = data.quantity

        # 종목 코드 찾기
        stock_code = find_stock_code(stock_name)
        if not stock_code:
            raise ValueError(f"주식 이름 '{stock_name}'에 대한 종목코드를 찾을 수 없습니다.")

        # KIS 인증 및 환경설정
        ka.auth(svr="vps", product="01")
        trenv = ka.getTREnv()

        # 계좌 정보 확인
        if not hasattr(trenv, 'my_acct') or not hasattr(trenv, 'my_prod'):
            raise ValueError("KIS 계좌 정보가 설정되지 않았습니다.")

        # 주식 매수 주문 (모의투자)
        buy_result = order_cash(
            env_dv="demo",  # 모의투자
            ord_dv="buy",   # 매수
            cano=trenv.my_acct,
            acnt_prdt_cd=trenv.my_prod,
            pdno=stock_code,
            ord_dvsn="01",  # 지정가
            ord_qty=str(quantity),
            ord_unpr="0",   # 시장가 (0으로 설정)
            excg_id_dvsn_cd="KRX"
        )

        # 결과 처리
        if buy_result.empty:
            raise ValueError("주문 결과를 받을 수 없습니다.")

        # DataFrame에서 첫 번째 행의 데이터 추출
        result_data = buy_result.iloc[0].to_dict()

        return StockBuyNodeOutput(
            success=True,
            order_id=result_data.get(
                'KRX_FWDG_ORD_ORGNO', '') + result_data.get('ODNO', ''),
            stock_name=stock_name,
            stock_code=stock_code,
            quantity=quantity,
            order_price=result_data.get('ORD_UNPR', ''),
            message=f"'{stock_name}' {quantity}주 매수 주문이 성공적으로 접수되었습니다.",
            order_time=result_data.get('ORD_TMD', '')
        )
