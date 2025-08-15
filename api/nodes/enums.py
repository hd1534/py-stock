
from enum import Enum


class NodeType(Enum):
    """노드 타입 정의"""
    INPUT = "input"
    PROCESS = "process"
    OUTPUT = "output"
    UTILITY = "utility"
