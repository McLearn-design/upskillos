#include "game.h"
#include <iostream>

int movePaddle(int y, bool up, bool down) {
    if (up) y -= 5;
    if (down) y += 5;
    if (y < 0) y = 0;
    if (y > courtHeight - paddleHeight) y = courtHeight - paddleHeight;
    return y;
}

void resetBall(GameState& game) {
    game.ballX = (courtWidth - ballSize) / 2;
    game.ballY = (courtHeight - ballSize) / 2;
    game.velocityX = -game.velocityX;
}

void update(GameState& game, const Input& input) {
    game.leftY = movePaddle(game.leftY, input.leftUp, input.leftDown);
    game.rightY = movePaddle(game.rightY, input.rightUp, input.rightDown);
    game.ballX += game.velocityX;
    game.ballY += game.velocityY;
    if (game.ballY < 0) {
        game.ballY = 0;
        game.velocityY = -game.velocityY;
    }
    if (game.ballY > courtHeight - ballSize) {
        game.ballY = courtHeight - ballSize;
        game.velocityY = -game.velocityY;
    }
    bool overlapsLeft = game.ballY + ballSize > game.leftY && game.ballY < game.leftY + paddleHeight;
    bool overlapsRight = game.ballY + ballSize > game.rightY && game.ballY < game.rightY + paddleHeight;
    if (game.velocityX < 0 && game.ballX <= leftX + paddleWidth && game.ballX + ballSize >= leftX && overlapsLeft) {
        game.ballX = leftX + paddleWidth;
        game.velocityX = -game.velocityX;
    }
    if (game.velocityX > 0 && game.ballX + ballSize >= rightX && game.ballX <= rightX + paddleWidth && overlapsRight) {
        game.ballX = rightX - ballSize;
        game.velocityX = -game.velocityX;
    }
    if (game.ballX + ballSize < 0) { ++game.rightScore; resetBall(game); }
    if (game.ballX > courtWidth) { ++game.leftScore; resetBall(game); }
}

int checkRules() {
    if (movePaddle(0, true, false) != 0) return 1;
    if (movePaddle(320, false, true) != 320) return 1;
    GameState game;
    game.ballY = 0;
    game.velocityY = -3;
    update(game, Input{});
    if (game.ballY != 0 || game.velocityY != 3) return 1;
    game.ballX = leftX + paddleWidth;
    game.ballY = game.leftY + 20;
    game.velocityX = -4;
    update(game, Input{});
    if (game.velocityX != 4) return 1;
    game.ballX = -ballSize;
    game.ballY = 20;
    game.velocityX = -4;
    update(game, Input{});
    if (game.rightScore != 1 || game.ballX != (courtWidth - ballSize) / 2) return 1;
    std::cout << "paddles-ok bounce-ok score-ok\n";
    return 0;
}

int main(int argc, char* argv[]) {
    if (argc > 1 && std::string(argv[1]) == "--check") return checkRules();
    GameState game;
    return runGame(game, update);
}
