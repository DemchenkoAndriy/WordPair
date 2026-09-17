#Requires AutoHotkey v2.0
#SingleInstance Force

; ============================================================================
;  Valheim — рівні грядки
;  Макрос саджає насіння рівною сіткою: клік -> крок убік -> клік -> ...
;  Кожні N рослин (типово 20) стає на перепочинок: садіння їсть стаміну,
;  і без паузи персонаж перестає ставити рослини.
;  Нічого в грі не патчить, працює на ванільному Valheim.
;
;  Гарячі клавіші (діють, коли активне вікно Valheim):
;    F8  — старт/стоп засівання
;    F9  — пауза / продовжити
;    F10 — аварійна зупинка (відпускає всі клавіші)
;    F7  — калібрування бічного кроку (садить 2 рослини через один крок)
;    F6  — калібрування кроку між рядами (садить 2 рослини через крок уперед)
;    F4  — вікно налаштувань
;    F3  — піпетка: точка «повно» (правий край бару стаміни)
;    F2  — піпетка: точка «порожньо» (лівий край бару стаміни)
;    F1  — живий контроль обох точок (для перевірки піпетки)
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
CoordMode "Pixel", "Screen"
CoordMode "Mouse", "Screen"

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
cfg.restEvery    := 20       ; перепочинок кожні N рослин (0 — без перепочинків)
cfg.restMs       := 10000    ; стоїмо й відновлюємо стаміну, мс (0 — чекати на F9)
cfg.staminaMode  := false    ; читати бар стаміни з екрана замість таймера
cfg.lowX         := 0        ; точка «порожньо» — лівий край бару
cfg.lowY         := 0
cfg.lowColor     := 0        ; колір цієї точки при ПОВНІЙ стаміні
cfg.fullX        := 0        ; точка «повно» — правий край бару
cfg.fullY        := 0
cfg.fullColor    := 0
cfg.tolerance    := 40       ; допуск на колір (0-255), більше — терпиміше
cfg.waitLimitMs  := 40000    ; стеля очікування стаміни, далі пауза до F9
cfg.startDelayMs := 800      ; затримка перед стартом — встигнути прибрати руки
cfg.dryRun       := false    ; репетиція: нічого не натискає, лише показує кроки
cfg.keyLeft      := "a"
cfg.keyRight     := "d"
cfg.keyForward   := "w"
cfg.keyBack      := "s"

global Running := false
global Paused  := false
global settingsGui := ""
global monitorOn := false

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
F3::PickPoint("full")
F2::PickPoint("low")
#HotIf

; Глобальні: мають спрацювати, навіть якщо фокус злетів з гри
F1::ToggleMonitor()
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

                ; пікселевий режим стежить за баром перед кожною рослиною,
                ; таймерний — рахує посаджене після неї
                if UsePixelStamina() && !StaminaGate(done, total)
                    return

                Plant()
                done++
                Status(Format("Ряд {1}/{2} · рослина {3}/{4} · разом {5}/{6}",
                    r, cfg.rows, c, cfg.cols, done, total), 0)

                if !UsePixelStamina() && cfg.restEvery > 0 && Mod(done, cfg.restEvery) = 0 && done < total {
                    if !Rest(done, total)
                        return
                }

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

; Перепочинок кожні cfg.restEvery рослин: садіння витрачає стаміну, тож без
; пауз персонаж просто перестане ставити рослини. Клавіші відпущені, стоїмо.
; Повертає false, якщо за час перепочинку прохід зупинили.
Rest(done, total) {
    global cfg, Paused

    ReleaseAll()

    if cfg.restMs <= 0 {
        Paused := true
        Status(Format("Перепочинок на стаміну: посаджено {1}/{2}. F9 — продовжити", done, total), 0)
        return Guard()
    }

    left := cfg.restMs
    while left > 0 {
        if !Guard()
            return false
        Status(Format("Відновлюю стаміну: {1} с · посаджено {2}/{3}", Round(left / 1000, 1), done, total), 0)
        Sleep 200
        left -= 200
    }
    return Guard()
}

ReleaseAll() {
    global cfg
    for key in [cfg.keyLeft, cfg.keyRight, cfg.keyForward, cfg.keyBack]
        Send "{Blind}{" key " up}"
    Click "Left Up"
}

; ---------------------------------------------------------------------------
;  Бар стаміни з екрана
;
;  Гра назовні нічого не віддає, тож єдиний зворотний зв'язок — пікселі.
;  Дві точки замість однієї дають гістерезис: саджаємо, доки горить точка
;  «порожньо», і чекаємо, доки не загориться точка «повно». Обидва кольори
;  знімаються піпеткою при ПОВНІЙ стаміні, тож логіка не залежить від того,
;  якого кольору бар і чи він ховається — порівнюємо з тим, що зняли.
; ---------------------------------------------------------------------------
PixelAt(x, y) {
    try
        return Integer(PixelGetColor(x, y))
    catch
        return -1
}

; Наскільки два кольори різні: найбільше розходження по каналу, 0-255.
ColorDist(c1, c2) {
    if c1 < 0 || c2 < 0
        return 255
    dr := Abs(((c1 >> 16) & 0xFF) - ((c2 >> 16) & 0xFF))
    dg := Abs(((c1 >> 8)  & 0xFF) - ((c2 >> 8)  & 0xFF))
    db := Abs(( c1        & 0xFF) - ( c2        & 0xFF))
    return Max(dr, dg, db)
}

StaminaCalibrated() {
    global cfg
    return cfg.lowX > 0 && cfg.lowY > 0 && cfg.fullX > 0 && cfg.fullY > 0
}

UsePixelStamina() {
    global cfg
    return cfg.staminaMode && StaminaCalibrated()
}

; Точка «порожньо» ще горить — стаміни вистачає, можна саджати далі.
StaminaOk() {
    global cfg
    return ColorDist(PixelAt(cfg.lowX, cfg.lowY), cfg.lowColor) <= cfg.tolerance
}

; Точка «повно» загорілася — бар набрався.
StaminaFull() {
    global cfg
    return ColorDist(PixelAt(cfg.fullX, cfg.fullY), cfg.fullColor) <= cfg.tolerance
}

; Піпетка. Знімається при ПОВНІЙ стамінІ: відкрий інвентар (Tab), щоб
; звільнити курсор, наведи його на бар і тисни клавішу.
PickPoint(which) {
    global cfg
    MouseGetPos(&x, &y)
    color := PixelAt(x, y)
    if color < 0 {
        Status("Не вдалося прочитати піксель. Гра має бути у вікні без рамки", 5000)
        return
    }

    if which = "low" {
        cfg.lowX := x, cfg.lowY := y, cfg.lowColor := color
        name := "порожньо"
    } else {
        cfg.fullX := x, cfg.fullY := y, cfg.fullColor := color
        name := "повно"
    }
    SaveSettings()
    Status(Format("Точка «{1}»: {2},{3} колір {4}. Перевір через F1", name, x, y, Format("0x{:06X}", color)), 6000)
}

; Живий контроль обох точок: видно, як вони гаснуть і загоряються.
ToggleMonitor() {
    global monitorOn
    monitorOn := !monitorOn
    if monitorOn {
        SetTimer MonitorTick, 200
    } else {
        SetTimer MonitorTick, 0
        ToolTip
    }
}

MonitorTick() {
    global cfg, monitorOn
    if !monitorOn
        return
    if !StaminaCalibrated() {
        Status("Піпетка не знята: F2 — точка «порожньо», F3 — точка «повно». F1 — вимкнути", 0)
        return
    }
    lowNow  := PixelAt(cfg.lowX, cfg.lowY)
    fullNow := PixelAt(cfg.fullX, cfg.fullY)
    Status(Format("порожньо: {1} (різниця {2}) · повно: {3} (різниця {4}) · допуск {5} · F1 — вимкнути",
        ColorDist(lowNow, cfg.lowColor) <= cfg.tolerance ? "горить" : "згасла",
        ColorDist(lowNow, cfg.lowColor),
        ColorDist(fullNow, cfg.fullColor) <= cfg.tolerance ? "горить" : "згасла",
        ColorDist(fullNow, cfg.fullColor),
        cfg.tolerance), 0)
}

; Перед посадкою: якщо стаміна на межі — стоїмо, доки бар не набереться.
; Повертає false, якщо прохід зупинили.
StaminaGate(done, total) {
    global cfg, Paused

    if StaminaOk()
        return true

    ReleaseAll()
    waited := 0
    while !StaminaFull() {
        if !Guard()
            return false
        Status(Format("Чекаю стаміну: {1} с · посаджено {2}/{3}", Round(waited / 1000, 1), done, total), 0)
        Sleep 200
        waited += 200

        if cfg.waitLimitMs > 0 && waited >= cfg.waitLimitMs {
            Paused := true
            Status(Format("Бар не набрався за {1} с — перевір піпетку через F1. F9 — продовжити", Round(waited / 1000)), 0)
            return Guard()
        }
    }
    return Guard()
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
BoolKeys() => ["serpentine", "dryRun", "staminaMode"]

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

    g.Add("Text", "xm w150", "Перепочинок кожні, шт:")
    ctlRestEvery := g.Add("Edit", "x+6 w70 Number", cfg.restEvery)

    g.Add("Text", "xm w150", "Перепочинок триває, мс:")
    ctlRestMs := g.Add("Edit", "x+6 w70 Number", cfg.restMs)

    g.Add("Text", "xm w340", "Перепочинок потрібен на відновлення стаміни. 0 мс означає «стояти, доки не натисну F9».")

    ctlStamina := g.Add("CheckBox", "xm w340", "Читати бар стаміни з екрана замість таймера")
    ctlStamina.Value := cfg.staminaMode ? 1 : 0

    g.Add("Text", "xm w150", "Допуск на колір:")
    ctlTolerance := g.Add("Edit", "x+6 w70 Number", cfg.tolerance)

    g.Add("Text", "xm w150", "Стеля очікування, мс:")
    ctlWaitLimit := g.Add("Edit", "x+6 w70 Number", cfg.waitLimitMs)

    ctlPoints := g.Add("Text", "xm w340", PointsSummary())

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
        cfg.restEvery    := Max(0, Integer(ctlRestEvery.Value = "" ? 0 : ctlRestEvery.Value))
        cfg.restMs       := Max(0, Integer(ctlRestMs.Value = "" ? 0 : ctlRestMs.Value))
        cfg.tolerance    := Max(0, Integer(ctlTolerance.Value = "" ? 0 : ctlTolerance.Value))
        cfg.waitLimitMs  := Max(0, Integer(ctlWaitLimit.Value = "" ? 0 : ctlWaitLimit.Value))
        cfg.staminaMode  := ctlStamina.Value = 1
        cfg.serpentine   := ctlSerp.Value = 1
        cfg.dryRun       := ctlDry.Value = 1
        SaveSettings()
    }

    btnSave.OnEvent("Click", (*) => (Apply(), ctlPoints.Value := PointsSummary(), Status("Збережено", 2000)))
    btnStart.OnEvent("Click", (*) => (Apply(), g.Hide(), FocusGameThen(RunGarden)))
    btnCal.OnEvent("Click", (*) => (Apply(), g.Hide(), FocusGameThen(() => CalibrateStep("side"))))
    g.OnEvent("Close", (*) => g.Hide())
    g.OnEvent("Escape", (*) => g.Hide())

    settingsGui := g
}

PointsSummary() {
    global cfg
    if !StaminaCalibrated()
        return "Точки бару не зняті. Відкрий інвентар (Tab), наведи курсор на бар: F2 — лівий край, F3 — правий."
    return Format("Точки зняті: «порожньо» {1},{2} · «повно» {3},{4}. F1 — перевірити наживо.",
        cfg.lowX, cfg.lowY, cfg.fullX, cfg.fullY)
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
