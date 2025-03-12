import json
from django.test import TestCase, Client
from django.urls import reverse
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

    def test_enter_leaderboard_higher_score(self):
        """Test submitting a higher score updates the entry."""
        # Setup initial player, game and score
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

        # Check DB
        score_entry = Score.objects.get(player=player, game=game)
        self.assertEqual(score_entry.score, 2000)

    def test_enter_leaderboard_lower_score(self):
        """Test submitting a lower score does not overwrite the higher score."""
        player = Player.objects.create(player_id='player_1', display_name='RetroPlayer')
        game = Game.objects.create(game_id='space-invaders', title='Space Invaders')
        Score.objects.create(player=player, game=game, score=1500)

        payload = {
            'game_id': 'space-invaders',
            'player_id': 'player_1',
            'display_name': 'RetroPlayer',
            'score': 1000
        }
        response = self.client.post(
            self.enter_url,
            data=json.dumps(payload),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 200)
        res_data = response.json()
        self.assertEqual(res_data['data']['highest_score'], 1500)
        self.assertFalse(res_data['data']['updated'])

        # Check DB still has 1500
        score_entry = Score.objects.get(player=player, game=game)
        self.assertEqual(score_entry.score, 1500)

    def test_get_game_leaderboard_ordering(self):
        """Test retrieving leaderboard returns ordered scores with correct ranks."""
        game = Game.objects.create(game_id='asteroids', title='Asteroids')
        
        # Create 3 players and scores
        p1 = Player.objects.create(player_id='p1', display_name='Player One')
        p2 = Player.objects.create(player_id='p2', display_name='Player Two')
        p3 = Player.objects.create(player_id='p3', display_name='Player Three')
        
        Score.objects.create(player=p1, game=game, score=500)
        Score.objects.create(player=p2, game=game, score=1000)
        Score.objects.create(player=p3, game=game, score=750)

        response = self.client.get(f"{self.get_url}?game_id=asteroids&limit=10")
        self.assertEqual(response.status_code, 200)
        leaderboard = response.json()

        # Check length & ranking
        self.assertEqual(len(leaderboard), 3)
        self.assertEqual(leaderboard[0]['rank'], 1)
        self.assertEqual(leaderboard[0]['player_id'], 'p2')
        self.assertEqual(leaderboard[0]['score'], 1000)

        self.assertEqual(leaderboard[1]['rank'], 2)
        self.assertEqual(leaderboard[1]['player_id'], 'p3')
        self.assertEqual(leaderboard[1]['score'], 750)

        self.assertEqual(leaderboard[2]['rank'], 3)
        self.assertEqual(leaderboard[2]['player_id'], 'p1')
        self.assertEqual(leaderboard[2]['score'], 500)

    def test_get_games(self):
        """Test listing available games in the system."""
        Game.objects.create(game_id='game-a', title='Game A')
        Game.objects.create(game_id='game-b', title='Game B')

        response = self.client.get(self.games_url)
        self.assertEqual(response.status_code, 200)
        games_list = response.json()

        self.assertEqual(len(games_list), 2)
        self.assertEqual(games_list[0]['title'], 'Game A')
        self.assertEqual(games_list[1]['title'], 'Game B')
