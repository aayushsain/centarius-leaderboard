import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.utils import timezone
from django.utils.text import slugify
from django.db import transaction, IntegrityError
from .models import Player, Game, Score

def home_view(request):
    """Serves the frontend dashboard page."""
    return render(request, 'leaderboard/index.html')

@csrf_exempt
def enter_leaderboard(request):
    """
    POST /api/enter-leaderboard/
    Saves or updates player score if it's the highest.
    """
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Only POST requests are allowed.'}, status=405)

    try:
        data = json.loads(request.body)
        game_id = data.get('game_id')
        player_id = data.get('player_id')
        display_name = data.get('display_name')
        score_val = data.get('score')

        if not all([game_id, player_id, display_name]) or score_val is None:
            return JsonResponse({'status': 'error', 'message': 'Missing required fields: game_id, player_id, display_name, score.'}, status=400)

        try:
            score_val = int(score_val)
        except (ValueError, TypeError):
            return JsonResponse({'status': 'error', 'message': 'Score must be an integer.'}, status=400)

        # Validation: avoid negative and zero
        if score_val <= 0:
            return JsonResponse({'status': 'error', 'message': 'Score must be greater than zero.'}, status=400)

        # Normalize and validate inputs
        game_id_clean = slugify(game_id)
        if not game_id_clean:
            return JsonResponse({'status': 'error', 'message': 'Invalid game_id.'}, status=400)

        player_id_clean = str(player_id).strip()
        display_name_clean = str(display_name).strip()

        if not player_id_clean or not display_name_clean:
            return JsonResponse({'status': 'error', 'message': 'Player ID and Display Name cannot be empty or whitespace-only.'}, status=400)

        if len(player_id_clean) > 100 or len(display_name_clean) > 100 or len(game_id_clean) > 100:
            return JsonResponse({'status': 'error', 'message': 'Required fields must be 100 characters or less.'}, status=400)

        try:
            with transaction.atomic():
                # Find or create Game and Player
                game, _ = Game.objects.get_or_create(
                    game_id=game_id_clean,
                    defaults={'title': game_id.strip().replace('-', ' ').replace('_', ' ').title()}
                )

                player, player_created = Player.objects.get_or_create(
                    player_id=player_id_clean,
                    defaults={'display_name': display_name_clean}
                )

                # Update display name if it changed
                if not player_created and player.display_name != display_name_clean:
                    player.display_name = display_name_clean
                    player.save()

                # Find or create score entry
                score_entry, score_created = Score.objects.get_or_create(
                    player=player,
                    game=game,
                    defaults={'score': score_val}
                )

                updated = False
                if not score_created:
                    # Atomic conditional update: only update if the new score is strictly greater
                    rows_updated = Score.objects.filter(
                        pk=score_entry.pk,
                        score__lt=score_val
                    ).update(score=score_val, date_saved=timezone.now())
                    if rows_updated > 0:
                        score_entry.refresh_from_db()
                        updated = True
                else:
                    updated = True

                return JsonResponse({
                    'status': 'success',
                    'message': 'Score processed successfully.',
                    'data': {
                        'game_id': game.game_id,
                        'player_id': player.player_id,
                        'display_name': player.display_name,
                        'highest_score': score_entry.score,
                        'updated': updated
                    }
                })
        except IntegrityError:
            # Re-try once in case of rare race condition between get_or_create calls
            # Usually handled by the atomic transaction, but IntegrityError can still surface
            return JsonResponse({'status': 'error', 'message': 'A concurrency conflict occurred. Please try again.'}, status=409)

    except json.JSONDecodeError:
        return JsonResponse({'status': 'error', 'message': 'Invalid JSON body.'}, status=400)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

def get_game_leaderboard(request):
    """
    GET /api/get-game-leaderboard/?game_id=<game_id>&limit=<limit>
    Returns sorted top scores for a specific game with dynamic ranks.
    """
    game_id = request.GET.get('game_id')
    if not game_id:
        return JsonResponse({'status': 'error', 'message': 'game_id parameter is required.'}, status=400)

    try:
        limit_val = request.GET.get('limit', 10)
        limit = int(limit_val)
    except ValueError:
        limit = 10

    # Query scores. Ordering is handled by Meta ([-score, date_saved])
    scores = Score.objects.filter(game__game_id=slugify(game_id)).select_related('player')[:limit]

    leaderboard_data = []
    for rank, entry in enumerate(scores, start=1):
        leaderboard_data.append({
            'rank': rank,
            'player_id': entry.player.player_id,
            'display_name': entry.player.display_name,
            'score': entry.score,
            'date_saved': entry.date_saved.isoformat()
        })

    return JsonResponse(leaderboard_data, safe=False)

def get_games(request):
    """
    GET /api/get-games/
    Returns a list of all games currently in the system.
    """
    games = Game.objects.all().order_by('title')
    game_list = [{'game_id': g.game_id, 'title': g.title} for g in games]
    return JsonResponse(game_list, safe=False)
