#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================================
;  Valheim — рівні грядки
;  Макрос саджає насіння рівною сіткою: клік -> крок убік -> клік -> ...
;  Нічого в грі не патчить, працює на ванільному Valheim.
;
;  Гарячі клавіші (діють, коли активне вікно Valheim):
;    F8  — старт/стоп засівання
;    F9  — пауза / продовжити
;    F10 — аварійна зупинка (відпускає всі клавіші)
;    F7  — калібрування бічного кроку (садить 2 рослини через один крок)
;    F6  — калібрування кроку між рядами (садить 2 рослини через крок уперед)
;    F4  — вікно налаштувань
;    Ctrl+Alt+R — перезапустити скрипт
;
;  Перед першим засіванням обов'язково прочитай README.md (калібрування).
; ============================================================================

; F8 має спрацювати вдруге як «стоп», поки перший потік ще саджає
#MaxThreadsPerHotkey 2

SendMode "Event"          ; Unity зазвичай ігнорує SendInput — тримаємо Event
SetKeyDelay 25, 25
SetMouseDelay 25
SetWorkingDir A_ScriptDir
CoordMode "ToolTip", "Screen"

global GAME := "ahk_exe valheim.exe"
global INI  := A_ScriptDir "\valheim-garden.ini"

; ---------------------------------------------------------------------------
;  Налаштування (правляться у вікні F4 або тут; зберігаються у .ini поруч)
; ---------------------------------------------------------------------------
global cfg := Object()
cfg.cols         := 8        ; рослин у ряду
cfg.rows         := 6        ; рядів
cfg.stepMs       := 260      ; тривалість бічного кроку між рослинами, мс
cfg.rowStepMs    := 260      ; тривалість кроку вперед між рядами, мс
cfg.serpentine   := true     ; змійка: кожен наступний ряд у зворотний бік
cfg.returnMs     := 0        ; добавка до зворотного проходу, коли змійка вимкнена
cfg.plantHoldMs  := 70       ; скільки тримати ліву кнопку миші
cfg.afterPlantMs := 320      ; пауза після посадки (кулдаун встановлення)
cfg.afterMoveMs  := 140      ; пауза після кроку, щоб персонаж зупинився
cfg.startDelayMs := 800      ; затримка перед стартом — встигнути прибрати руки
cfg.dryRun       := false    ; репетиція: нічого не натискає, лише показує кроки
cfg.keyLeft      := "a"
cfg.keyRight     := "d"
cfg.keyForward   := "w"
cfg.keyBack      := "s"

global Running := false
global Paused  := false
global settingsGui := ""

LoadSettings()
BuildGui()
Status("Valheim: рівні грядки. F4 — налаштування, F8 — старт.", 4000)

; ---------------------------------------------------------------------------
;  Гарячі клавіші
; ---------------------------------------------------------------------------
#HotIf WinActive(GAME)
F8::
{
    global Running
    if Running
        StopRun("Зупинено з F8")
    else
        RunGarden()
}
F7::CalibrateStep("side")
F6::CalibrateStep("forward")
#HotIf

; Пауза й аварійна зупинка — глобальні, працюють навіть якщо фокус злетів
F9::TogglePause()
F10::StopRun("Аварійна зупинка (F10)")
F4::ShowSettings()
^!r::Reload

; ---------------------------------------------------------------------------
;  Основний прохід
; ---------------------------------------------------------------------------
RunGarden() {
    global cfg, Running, Paused

    if Running
        return
    Running := true
    Paused  := false

    Status("Старт через " cfg.startDelayMs " мс — не чіпай мишу й клавіатуру", cfg.startDelayMs)
    Sleep cfg.startDelayMs

    total := cfg.rows * cfg.cols
    done  := 0

    try {
        loop cfg.rows {
            r := A_Index
            ; напрямок ряду: змійка розвертає кожен парний ряд
            dirKey := (cfg.serpentine && Mod(r, 2) = 0) ? cfg.keyLeft : cfg.keyRight

            loop cfg.cols {
                c := A_Index
                if !Guard()
                    return

                Plant()
                done++
                Status(Format("Ряд {1}/{2} · рослина {3}/{4} · разом {5}/{6}",
                    r, cfg.rows, c, cfg.cols, done, total), 0)

                if c < cfg.cols {
                    if !Guard()
                        return
                    Move(dirKey, cfg.stepMs)
                }
            }

            if r < cfg.rows {
                if !Guard()
                    return
                Move(cfg.keyForward, cfg.rowStepMs)

                if !cfg.serpentine {
                    ; повертаємося до початку ряду одним довгим проходом
                    back := cfg.stepMs * (cfg.cols - 1) + cfg.returnMs
                    if back > 0
                        Move(cfg.keyLeft, back)
                }
            }
        }
        Status("Готово: посаджено " done " шт. Перевір, чи всюди зійшло.", 6000)
    } finally {
        ReleaseAll()
        Running := false
        Paused  := false
    }
}

StopRun(reason := "Зупинено") {
    global Running, Paused
    if !Running {
        Status(reason, 2000)
        return
    }
    Running := false
    Paused  := false
    ReleaseAll()
    Status(reason, 3000)
}

TogglePause() {
    global Running, Paused
    if !Running {
        Status("Нема чого ставити на паузу", 2000)
        return
    }
    Paused := !Paused
    if Paused {
        ReleaseAll()
        Status("Пауза. F9 — продовжити, F10 — зупинити", 0)
    } else {
        Status("Продовжую…", 1500)
    }
}

; Перевірка перед кожною дією: чи не зупинили, чи не на паузі, чи в грі.
; Повертає false, якщо прохід треба обірвати.
Guard() {
    global Running, Paused, GAME

    loop {
        if !Running
            return false

        if !WinActive(GAME) && !Paused {
            ReleaseAll()
            Paused := true
            Status("Пауза: вікно Valheim втратило фокус. Поверни фокус і тисни F9", 0)
        }

        if !Paused
            return true

        Sleep 100
    }
}

; ---------------------------------------------------------------------------
;  Елементарні дії
; ---------------------------------------------------------------------------
Plant() {
    global cfg
    if !cfg.dryRun {
        Click "Left Down"
        Sleep cfg.plantHoldMs
        Click "Left Up"
    }
    Sleep cfg.afterPlantMs
}

Move(key, ms) {
    global cfg
    if cfg.dryRun {
        Sleep ms
        Sleep cfg.afterMoveMs
        return
    }
    Send "{Blind}{" key " down}"
    Sleep ms
    Send "{Blind}{" key " up}"
    Sleep cfg.afterMoveMs
}

ReleaseAll() {
    global cfg
    for key in [cfg.keyLeft, cfg.keyRight, cfg.keyForward, cfg.keyBack]
        Send "{Blind}{" key " up}"
    Click "Left Up"
}

; ---------------------------------------------------------------------------
;  Калібрування: саджає дві рослини через один крок.
;  Відстань між ними — це і є крок сітки. Міряємо не швидкість, а сам крок:
;  розгін персонажа входить у кожен короткий ривок однаково.
; ---------------------------------------------------------------------------
CalibrateStep(axis) {
    global cfg, Running, Paused

    if Running
        return
    Running := true
    Paused  := false

    ms  := (axis = "forward") ? cfg.rowStepMs : cfg.stepMs
    key := (axis = "forward") ? cfg.keyForward : cfg.keyRight
    name := (axis = "forward") ? "крок між рядами" : "бічний крок"

    Status("Калібрування: " name " = " ms " мс. Старт через " cfg.startDelayMs " мс", cfg.startDelayMs)
    Sleep cfg.startDelayMs

    try {
        if !Guard()
            return
        Plant()
        if !Guard()
            return
        Move(key, ms)
        if !Guard()
            return
        Plant()
        Status("Готово. Зміряй проміжок між двома рослинами й підбери " name " у F4", 8000)
    } finally {
        ReleaseAll()
        Running := false
        Paused  := false
    }
}

; ---------------------------------------------------------------------------
;  Підказка на екрані
; ---------------------------------------------------------------------------
Status(text, timeoutMs := 3000) {
    ToolTip text, 20, 20
    SetTimer ClearStatus, 0
    if timeoutMs > 0
        SetTimer ClearStatus, -timeoutMs
}

ClearStatus() {
    ToolTip
}

; ---------------------------------------------------------------------------
;  Налаштування: збереження й вікно
; ---------------------------------------------------------------------------
BoolKeys() => ["serpentine", "dryRun"]

LoadSettings() {
    global cfg, INI
    if !FileExist(INI)
        return
    bools := BoolKeys()
    for key, value in cfg.OwnProps() {
        if value is String
            continue
        raw := IniRead(INI, "garden", key, "")
        if raw = ""
            continue
        if HasVal(bools, key)
            cfg.%key% := (raw = "1")
        else if IsInteger(raw)
            cfg.%key% := Integer(raw)
    }
}

HasVal(arr, needle) {
    for item in arr
        if item = needle
            return true
    return false
}

SaveSettings() {
    global cfg, INI
    bools := BoolKeys()
    for key, value in cfg.OwnProps() {
        if value is String
            continue
        IniWrite(HasVal(bools, key) ? (value ? 1 : 0) : value, INI, "garden", key)
    }
}

BuildGui() {
    global cfg, settingsGui

    g := Gui("+AlwaysOnTop -MinimizeBox", "Valheim — рівні грядки")
    g.MarginX := 12
    g.MarginY := 12
    g.SetFont("s9", "Segoe UI")

    g.Add("Text", "xm w340", "Стань на початок грядки, візьми культиватор і обери насіння.`nКамеру далі не чіпай: привид рослини стоїть на місці, а сітку малює рух персонажа.")

    g.Add("Text", "xm w150", "Рослин у ряду:")
    ctlCols := g.Add("Edit", "x+6 w70 Number", cfg.cols)

    g.Add("Text", "xm w150", "Рядів:")
    ctlRows := g.Add("Edit", "x+6 w70 Number", cfg.rows)

    g.Add("Text", "xm w150", "Бічний крок, мс:")
    ctlStep := g.Add("Edit", "x+6 w70 Number", cfg.stepMs)

    g.Add("Text", "xm w150", "Крок між рядами, мс:")
    ctlRowStep := g.Add("Edit", "x+6 w70 Number", cfg.rowStepMs)

    g.Add("Text", "xm w150", "Пауза після посадки, мс:")
    ctlAfterPlant := g.Add("Edit", "x+6 w70 Number", cfg.afterPlantMs)

    g.Add("Text", "xm w150", "Пауза після кроку, мс:")
    ctlAfterMove := g.Add("Edit", "x+6 w70 Number", cfg.afterMoveMs)

    ctlSerp := g.Add("CheckBox", "xm w340", "Змійка (наступний ряд у зворотний бік)")
    ctlSerp.Value := cfg.serpentine ? 1 : 0

    ctlDry := g.Add("CheckBox", "xm w340", "Репетиція: не натискати нічого, лише показувати кроки")
    ctlDry.Value := cfg.dryRun ? 1 : 0

    btnSave := g.Add("Button", "xm w110", "Зберегти")
    btnStart := g.Add("Button", "x+8 w110", "Старт (F8)")
    btnCal := g.Add("Button", "x+8 w110", "Калібрувати (F7)")

    g.Add("Text", "xm w340", "F9 — пауза · F10 — аварійна зупинка · F6 — калібрувати ряди")

    Apply(*) {
        cfg.cols         := Max(1, Integer(ctlCols.Value = "" ? 1 : ctlCols.Value))
        cfg.rows         := Max(1, Integer(ctlRows.Value = "" ? 1 : ctlRows.Value))
        cfg.stepMs       := Max(0, Integer(ctlStep.Value = "" ? 0 : ctlStep.Value))
        cfg.rowStepMs    := Max(0, Integer(ctlRowStep.Value = "" ? 0 : ctlRowStep.Value))
        cfg.afterPlantMs := Max(0, Integer(ctlAfterPlant.Value = "" ? 0 : ctlAfterPlant.Value))
        cfg.afterMoveMs  := Max(0, Integer(ctlAfterMove.Value = "" ? 0 : ctlAfterMove.Value))
        cfg.serpentine   := ctlSerp.Value = 1
        cfg.dryRun       := ctlDry.Value = 1
        SaveSettings()
    }

    btnSave.OnEvent("Click", (*) => (Apply(), Status("Збережено", 2000)))
    btnStart.OnEvent("Click", (*) => (Apply(), g.Hide(), FocusGameThen(RunGarden)))
    btnCal.OnEvent("Click", (*) => (Apply(), g.Hide(), FocusGameThen(() => CalibrateStep("side"))))
    g.OnEvent("Close", (*) => g.Hide())
    g.OnEvent("Escape", (*) => g.Hide())

    settingsGui := g
}

ShowSettings(*) {
    global settingsGui
    settingsGui.Show("AutoSize")
}

FocusGameThen(fn) {
    global GAME
    if !WinExist(GAME) {
        Status("Valheim не запущено", 3000)
        return
    }
    WinActivate GAME
    if !WinWaitActive(GAME, , 3) {
        Status("Не вдалося перемкнутися на Valheim", 3000)
        return
    }
    Sleep 300
    fn()
}
