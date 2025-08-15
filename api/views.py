from django.http import JsonResponse, HttpResponseNotAllowed
from django.views.decorators.csrf import csrf_exempt
from typing import Any, Dict, List

from api.nodes import NODES
from .models import Workflow

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
