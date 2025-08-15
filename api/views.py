import json
from typing import Any, Dict, List

from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt

from api.nodes import NODES
from .models import Workflow


# TODO: using django-rest-framework

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


def workflows_list(request):
    if request.method == 'GET':
        items = list(Workflow.objects.all().order_by(
            '-updated_at').values('id', 'name', 'updated_at', 'created_at'))
        return JsonResponse(items, safe=False)
    return HttpResponseNotAllowed(['GET'])


@csrf_exempt
def workflows_detail(request, wf_id: int):
    try:
        wf = Workflow.objects.get(id=wf_id)
    except Workflow.DoesNotExist:
        return JsonResponse({'error': 'not found'}, status=404)

    if request.method == 'GET':
        return JsonResponse({'id': wf.id, 'name': wf.name, 'data': wf.data, 'updated_at': wf.updated_at, 'created_at': wf.created_at}, safe=False)
    elif request.method in ['PUT', 'PATCH']:
        import json
        try:
            body = json.loads(request.body or '{}')
        except Exception:
            return JsonResponse({'error': 'invalid json'}, status=400)
        wf.name = body.get('name', wf.name)
        if 'data' in body:
            wf.data = body['data']
        wf.save()
        return JsonResponse({'ok': True, 'id': wf.id})
    elif request.method == 'DELETE':
        wf.delete()
        return JsonResponse({'ok': True})
    return HttpResponseNotAllowed(['GET', 'PUT', 'PATCH', 'DELETE'])


@csrf_exempt
def workflows_create(request):
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])
    import json
    try:
        body = json.loads(request.body or '{}')
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)
    name = body.get('name') or 'Untitled'
    data = body.get('data') or {}
    wf = Workflow.objects.create(name=name, data=data)
    return JsonResponse({'ok': True, 'id': wf.id})


@csrf_exempt
def node_execute(request, node_id: str):
    """특정 ID를 가진 노드를 실행하는 엔드포인트"""
    if request.method != 'POST':
        return HttpResponseNotAllowed(['POST'])

    # 요청 데이터 파싱
    try:
        data = json.loads(request.body or '{}')
    except Exception:
        return JsonResponse({'error': 'invalid json'}, status=400)

    # NODES에서 해당 ID를 가진 노드 클래스 찾기
    target_node_class = None
    for node_class in NODES:
        # 클래스인 경우 임시 인스턴스를 만들어서 NODE_ID 확인
        if isinstance(node_class, type):
            temp_instance = node_class()
            if hasattr(temp_instance, 'NODE_ID') and temp_instance.NODE_ID == node_id:
                target_node_class = node_class
                break
        else:
            # 이미 인스턴스인 경우
            if hasattr(node_class, 'NODE_ID') and node_class.NODE_ID == node_id:
                target_node_class = type(node_class)
                break

    if target_node_class is None:
        return JsonResponse({'error': f'node with id "{node_id}" not found'}, status=404)

    # 노드 인스턴스 생성 및 실행
    try:
        node_instance = target_node_class()

        # BaseNode의 run() 메서드를 사용하여 검증과 실행을 한번에 처리
        execution_result = node_instance.run(data)

        if execution_result.success:
            return JsonResponse({
                'success': True,
                'node_id': node_id,
                'result': execution_result.outputs
            })
        else:
            return JsonResponse({
                'success': False,
                'node_id': node_id,
                'error': execution_result.error
            }, status=400)

    except Exception as e:
        return JsonResponse({
            'success': False,
            'node_id': node_id,
            'error': str(e)
        }, status=500)
