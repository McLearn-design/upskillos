#pragma once
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <string>

constexpr int courtWidth = 640;
constexpr int courtHeight = 400;
constexpr int paddleHeight = 80;
constexpr int paddleWidth = 12;
constexpr int leftX = 24;
constexpr int rightX = courtWidth - 24 - paddleWidth;
constexpr int ballSize = 12;

struct GameState {
    int leftY = 160;
    int rightY = 160;
    int ballX = 314;
    int ballY = 194;
    int velocityX = 4;
    int velocityY = 3;
    int leftScore = 0;
    int rightScore = 0;
};
struct Input {
    bool leftUp = false;
    bool leftDown = false;
    bool rightUp = false;
    bool rightDown = false;
};
using UpdateFunction = void (*)(GameState&, const Input&);
struct WindowContext { GameState& game; UpdateFunction update; };

inline void drawBox(HDC canvas, int x, int y, int width, int height, COLORREF color) {
    RECT box{x, y, x + width, y + height};
    HBRUSH brush = CreateSolidBrush(color);
    FillRect(canvas, &box, brush);
    DeleteObject(brush);
}

inline LRESULT CALLBACK pongWindowProc(HWND window, UINT message, WPARAM key, LPARAM data) {
    if (message == WM_NCCREATE) {
        auto* create = reinterpret_cast<CREATESTRUCTA*>(data);
        SetWindowLongPtrA(window, GWLP_USERDATA, reinterpret_cast<LONG_PTR>(create->lpCreateParams));
    }
    auto* context = reinterpret_cast<WindowContext*>(GetWindowLongPtrA(window, GWLP_USERDATA));
    if (message == WM_TIMER && context) {
        Input input;
        input.leftUp = (GetAsyncKeyState('W') & 0x8000) != 0;
        input.leftDown = (GetAsyncKeyState('S') & 0x8000) != 0;
        input.rightUp = (GetAsyncKeyState(VK_UP) & 0x8000) != 0;
        input.rightDown = (GetAsyncKeyState(VK_DOWN) & 0x8000) != 0;
        // Another app's keyboard input must not control this game.
        if (GetForegroundWindow() != window) input = Input{};
        context->update(context->game, input);
        InvalidateRect(window, nullptr, FALSE);
        return 0;
    }
    if (message == WM_KEYDOWN && key == VK_ESCAPE) { DestroyWindow(window); return 0; }
    if (message == WM_PAINT && context) {
        PAINTSTRUCT paint;
        HDC canvas = BeginPaint(window, &paint);
        RECT client;
        GetClientRect(window, &client);
        HBRUSH background = CreateSolidBrush(RGB(12, 17, 26));
        FillRect(canvas, &client, background);
        DeleteObject(background);
        const auto& game = context->game;
        for (int y = 8; y < courtHeight; y += 24) drawBox(canvas, courtWidth / 2 - 1, y, 2, 12, RGB(65, 75, 90));
        drawBox(canvas, leftX, game.leftY, paddleWidth, paddleHeight, RGB(70, 190, 255));
        drawBox(canvas, rightX, game.rightY, paddleWidth, paddleHeight, RGB(255, 185, 70));
        drawBox(canvas, game.ballX, game.ballY, ballSize, ballSize, RGB(240, 245, 255));
        SetBkMode(canvas, TRANSPARENT);
        SetTextColor(canvas, RGB(240, 245, 255));
        std::string score = std::to_string(game.leftScore) + "   :   " + std::to_string(game.rightScore);
        TextOutA(canvas, 290, 12, score.c_str(), static_cast<int>(score.size()));
        const char* help = "Left: W / S     Right: Up / Down     Escape: close";
        TextOutA(canvas, 110, courtHeight + 12, help, lstrlenA(help));
        EndPaint(window, &paint);
        return 0;
    }
    if (message == WM_DESTROY) { KillTimer(window, 1); PostQuitMessage(0); return 0; }
    return DefWindowProcA(window, message, key, data);
}

inline int runGame(GameState& game, UpdateFunction update) {
    HINSTANCE instance = GetModuleHandleA(nullptr);
    WNDCLASSA type{};
    type.lpfnWndProc = pongWindowProc;
    type.hInstance = instance;
    type.hCursor = LoadCursor(nullptr, IDC_ARROW);
    type.lpszClassName = "UpSkillOSPong";
    if (!RegisterClassA(&type) && GetLastError() != ERROR_CLASS_ALREADY_EXISTS) return 1;
    WindowContext context{game, update};
    RECT size{0, 0, courtWidth, courtHeight + 40};
    const DWORD style = WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_MINIMIZEBOX;
    AdjustWindowRect(&size, style, FALSE);
    HWND window = CreateWindowExA(0, type.lpszClassName, "Pong - C++ Lesson 1", style,
        CW_USEDEFAULT, CW_USEDEFAULT, size.right - size.left, size.bottom - size.top,
        nullptr, nullptr, instance, &context);
    if (!window) return 1;
    if (!SetTimer(window, 1, 16, nullptr)) { DestroyWindow(window); return 1; }
    ShowWindow(window, SW_SHOW);
    MSG message{};
    int result;
    while ((result = GetMessageA(&message, nullptr, 0, 0)) > 0) {
        TranslateMessage(&message);
        DispatchMessageA(&message);
    }
    return result == -1 ? 1 : static_cast<int>(message.wParam);
}
