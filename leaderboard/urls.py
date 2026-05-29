from django.urls import path
from . import views

urlpatterns = [
    path('', views.home_view, name='home'),
    path('api/enter-leaderboard/', views.enter_leaderboard, name='enter_leaderboard'),
    path('api/get-game-leaderboard/', views.get_game_leaderboard, name='get_game_leaderboard'),
    path('api/get-games/', views.get_games, name='get_games'),
]
