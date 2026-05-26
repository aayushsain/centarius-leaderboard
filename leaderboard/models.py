from django.db import models

class Player(models.Model):
    player_id = models.CharField(max_length=100, unique=True, db_index=True)
    display_name = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.display_name} ({self.player_id})"

class Game(models.Model):
    game_id = models.CharField(max_length=100, unique=True, db_index=True)
    title = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title

class Score(models.Model):
    player = models.ForeignKey(Player, on_delete=models.CASCADE, related_name='scores')
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='scores')
    score = models.BigIntegerField()
    date_saved = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('player', 'game')
        ordering = ['-score', 'date_saved']
        indexes = [
            models.Index(fields=['game', '-score', 'date_saved']),
        ]

    def __str__(self):
        return f"{self.player.display_name} - {self.game.title}: {self.score}"
