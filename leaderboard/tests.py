import json
import time
from django.test import TestCase, Client
from django.urls import reverse
from django.utils import timezone
from .models import Player, Game, Score

class LeaderboardAPITests(TestCase):
    def setUp(self):
        self.client = Client()
        self.enter_url = reverse('enter_leaderboard')
        self.get_url = reverse('get_game_leaderboard')
        self.games_url = reverse('get_games')

    def test_enter_leaderboard_new_player(self):
        """Test submitting a score for a new player creates records correctly."""
        payload = {
            'game_id': 'space-invaders',
            'player_id': 'player_1',
            'display_name': 'RetroPlayer',
            'score': 1500
        }
        response = self.client.post(
            self.enter_url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        res_data = response.json()
        self.assertEqual(res_data['status'], 'success')
        self.assertEqual(res_data['data']['highest_score'], 1500)
        self.assertTrue(res_data['data']['updated'])

        # Verify DB entry
        self.assertTrue(Player.objects.filter(player_id='player_1').exists())
        self.assertTrue(Game.objects.filter(game_id='space-invaders').exists())
        self.assertTrue(Score.objects.filter(player__player_id='player_1', game__game_id='space-invaders', score=1500).exists())

    def test_big_integer_support(self):
        """Test that the system supports scores larger than 2^31-1."""
        big_score = 3000000000 # 3 Billion
        payload = {
            'game_id': 'big-game',
            'player_id': 'p_big',
            'display_name': 'Giant',
            'score': big_score
        }
        response = self.client.post(
            self.enter_url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['data']['highest_score'], big_score)

    def test_tie_breaker_logic(self):
        """Test that the person who achieved the score first ranks higher."""
        game = Game.objects.create(game_id='race', title='Race')
        p1 = Player.objects.create(player_id='p1', display_name='First')
        p2 = Player.objects.create(player_id='p2', display_name='Second')

        # P1 scores 100 first
        Score.objects.create(player=p1, game=game, score=100)
        # Sleep briefly to ensure different timestamp if needed,
        # though auto_now usually handles it in sequence.
        time.sleep(0.1)
        # P2 scores 100 later
        Score.objects.create(player=p2, game=game, score=100)

        response = self.client.get(f"{self.get_url}?game_id=race")
        leaderboard = response.json()

        self.assertEqual(leaderboard[0]['player_id'], 'p1')
        self.assertEqual(leaderboard[1]['player_id'], 'p2')

    def test_validation_negative_and_zero_score(self):
        """Test that zero or negative scores are rejected."""
        for score in [0, -1, -500]:
            payload = {
                'game_id': 'valid-game',
                'player_id': 'p1',
                'display_name': 'Player',
                'score': score
            }
            response = self.client.post(
                self.enter_url,
                data=json.dumps(payload),
                content_type='application/json'
            )
            self.assertEqual(response.status_code, 400)
            self.assertIn('greater than zero', response.json()['message'])

    def test_validation_empty_names(self):
        """Test that empty or whitespace-only names are rejected."""
        payload = {
            'game_id': 'valid-game',
            'player_id': 'p1',
            'display_name': '   ',
            'score': 100
        }
        response = self.client.post(
            self.enter_url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('cannot be empty', response.json()['message'])

    def test_game_normalization_prevents_duplicates(self):
        """Test that 'Space Invaders' and 'space-invaders' resolve to the same game_id."""
        self.client.post(
            self.enter_url,
            data=json.dumps({'game_id': 'Space Invaders', 'player_id': 'p1', 'display_name': 'P1', 'score': 100}),
            content_type='application/json'
        )
        self.client.post(
            self.enter_url,
            data=json.dumps({'game_id': 'space-invaders', 'player_id': 'p2', 'display_name': 'P2', 'score': 200}),
            content_type='application/json'
        )

        self.assertEqual(Game.objects.count(), 1)
        self.assertEqual(Game.objects.first().game_id, 'space-invaders')

    def test_enter_leaderboard_higher_score(self):
        """Test submitting a higher score updates the entry."""
        player = Player.objects.create(player_id='player_1', display_name='RetroPlayer')
        game = Game.objects.create(game_id='space-invaders', title='Space Invaders')
        Score.objects.create(player=player, game=game, score=1500)

        payload = {
            'game_id': 'space-invaders',
            'player_id': 'player_1',
            'display_name': 'RetroPlayer',
            'score': 2000
        }
        response = self.client.post(
            self.enter_url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        res_data = response.json()
        self.assertEqual(res_data['data']['highest_score'], 2000)
        self.assertTrue(res_data['data']['updated'])

        score_entry = Score.objects.get(player=player, game=game)
        self.assertEqual(score_entry.score, 2000)
