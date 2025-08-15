from django.http import JsonResponse
from typing import Any, Dict, List

from api.nodes import NODES

# Create your views here.


def health_check(request):
    return JsonResponse({'status': 'healthy', 'message': 'API is running'})


def nodes_list(request):
    """등록된 모든 노드의 정보(get_info)를 반환"""
    nodes_info: List[Dict[str, Any]] = []
    for item in NODES:
        try:
            # NODES 항목이 클래스이든 인스턴스이든 모두 대응
            obj = item if not isinstance(item, type) else item()
            info = obj.get_info()
            nodes_info.append(info)
        except Exception as e:
            nodes_info.append({
                "id": getattr(item, 'NODE_ID', 'unknown'),
                "error": f"failed to load node info: {e}"
            })
    return JsonResponse(nodes_info, safe=False)
