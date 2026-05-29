import random
from django.core.management.base import BaseCommand
from django.utils import timezone
from leaderboard.models import Player, Game, Score

class Command(BaseCommand):
    help = 'Seeds the database with high-quality retro game titles and realistic tournament scores.'

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING('Clearing existing data...'))
        Score.objects.all().delete()
        Game.objects.all().delete()
        Player.objects.all().delete()

        self.stdout.write(self.style.MIGRATE_LABEL('Creating Games/Tournaments...'))
        games_data = [
            {'game_id': 'centarius-run', 'title': 'Centarius Run'},
            {'game_id': 'space-invaders', 'title': 'Space Invaders'},
            {'game_id': 'pac-man', 'title': 'Pac-Man'},
            {'game_id': 'asteroids', 'title': 'Asteroids'},
            {'game_id': 'cyber-knight', 'title': 'Cyber Knight'},
        ]
        games = []
        for g in games_data:
            game = Game.objects.create(game_id=g['game_id'], title=g['title'])
            games.append(game)
            self.stdout.write(f"  Created Game: {game.title} ({game.game_id})")

        self.stdout.write(self.style.MIGRATE_LABEL('Creating Players...'))
        players_data = [
            {'player_id': 'cyber_knight', 'display_name': 'CyberKnight'},
            {'player_id': 'retro_rex', 'display_name': 'RetroRex'},
            {'player_id': 'pixel_queen', 'display_name': 'PixelQueen'},
            {'player_id': 'alpha_omega', 'display_name': 'AlphaOmega'},
            {'player_id': 'glitch_hunter', 'display_name': 'GlitchHunter'},
            {'player_id': 'bit_boss', 'display_name': 'BitBoss'},
            {'player_id': 'synth_wave', 'display_name': 'SynthWave'},
            {'player_id': 'neon_ninja', 'display_name': 'NeonNinja'},
            {'player_id': 'vector_victor', 'display_name': 'VectorVictor'},
            {'player_id': 'arcade_ace', 'display_name': 'ArcadeAce'},
        ]
        players = []
        for p in players_data:
            player = Player.objects.create(player_id=p['player_id'], display_name=p['display_name'])
            players.append(player)
            self.stdout.write(f"  Created Player: {player.display_name} ({player.player_id})")

        self.stdout.write(self.style.MIGRATE_LABEL('Generating Competitive High Scores...'))
        
        # Configure unique parameters for each game to generate highly realistic, thematic distributions
        score_configs = {
            'centarius-run': {'min': 1200, 'max': 9850, 'step': 50},
            'space-invaders': {'min': 8000, 'max': 45000, 'step': 100},
            'pac-man': {'min': 25000, 'max': 280000, 'step': 10},
            'asteroids': {'min': 15000, 'max': 99000, 'step': 100},
            'cyber-knight': {'min': 150000, 'max': 950000, 'step': 1000},
        }

        score_count = 0
        for game in games:
            config = score_configs[game.game_id]
            
            # Select 7-10 random players to have scores in this game to make the database look organic
            num_players = random.randint(7, len(players))
            active_players = random.sample(players, num_players)
            
            # Generate sorted scores to ensure top ranks feel special
            scores = []
            for _ in range(num_players):
                val = random.randint(config['min'], config['max'])
                # Round to clean steps
                val = (val // config['step']) * config['step']
                scores.append(val)
            scores.sort(reverse=True)

            for i, player in enumerate(active_players):
                Score.objects.create(
                    player=player,
                    game=game,
                    score=scores[i]
                )
                score_count += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully seeded database with {len(games)} games, {len(players)} players, and {score_count} score submissions!"))
