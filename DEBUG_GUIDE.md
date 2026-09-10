# 🔍 ДИАГНОСТИКА - Проверка видимости игроков

## Шаги для диагностики:

### 1. Откройте консоль браузера (F12)

**В обоих окнах браузера:**
- Нажмите F12
- Перейдите на вкладку "Console"
- Оставьте консоль открытой

### 2. Создайте лобби и начните игру

**Игрок 1:**
1. http://localhost:3000/lobby.html
2. Создать лобби
3. ✅ Включить манекены
4. Подождать второго игрока

**Игрок 2:**
1. http://localhost:3000/lobby.html (новое окно)
2. Присоединиться к лобби
3. Хост запускает игру

### 3. Что искать в консоли:

#### При отправке позиций (должно быть у обоих):
```
Sending position: X.XX Z.ZZ
```

#### При получении позиций другого игрока:
```
Received player update: [socket-id] at X.XX Z.ZZ
```

#### При создании модели игрока (должно быть ОДИН раз):
```
🎨 Creating player model for: [socket-id] Team: red/blue
✅ Player model created and added to scene. Children count: 6
   Position: 0 0 0
   Color: #ff4444 (или #4488ff, #44ff44)
```

#### Если игрок появился:
```
✅ New player created: [socket-id] Total players: 1
```

### 4. Проверьте Three.js сцену:

**В консоли любого окна выполните:**
```javascript
// Проверить всех игроков в памяти
console.log('Other players:', otherPlayers.size);
otherPlayers.forEach((p, id) => {
    console.log('Player:', id, 'Position:', p.group.position);
});

// Проверить все объекты в сцене
console.log('Scene children:', scene.children.length);
scene.children.forEach((obj, i) => {
    if (obj.type === 'Group') {
        console.log(i, 'Group at:', obj.position.x.toFixed(2), obj.position.y.toFixed(2), obj.position.z.toFixed(2));
    }
});
```

### 5. Возможные проблемы:

#### ❌ Если НЕ видите "Creating player model":
- Socket.IO не работает
- Игроки в разных лобби
- События не доходят

#### ❌ Если видите создание, но НЕ видите модель:
- Модель вне камеры (далеко)
- Масштаб модели слишком мал
- Z-fighting или прозрачность

#### ❌ Если "Received player update" НЕ приходит:
- Сервер не передаёт данные
- Socket.IO не подключен
- Игрок не двигается (позиции не отправляются)

### 6. Принудительный тест:

**В консоли Игрока 1 выполните:**
```javascript
// Создать тестовую модель прямо перед камерой
const testModel = createPlayerModel('test-123', 'red');
testModel.group.position.set(
    camera.position.x + 2,  // 2 метра впереди
    0,
    camera.position.z - 5
);
console.log('Test model created at:', testModel.group.position);
```

**Должны увидеть красную фигурку впереди!**

### 7. Проверка миникарты:

Посмотрите на **миникарту** (левый верхний угол):
- ✅ Зелёная/красная/синяя точка = вы
- 🟡 Желтая точка = другой игрок
- Если желтой точки НЕТ → `otherPlayers` пустой

### 8. Логи сервера:

```bash
cat server.log | grep -i "player\|socket"
```

Должно быть:
```
Player connected: [id1]
[name1] joined lobby [lobbyId]
Player connected: [id2]
[name2] joined lobby [lobbyId]
Game starting in lobby [lobbyId]
```

---

## Что проверить СЕЙЧАС:

1. **F12 → Console** в обоих окнах
2. Начните игру
3. Двигайтесь (WASD)
4. Смотрите консоль - есть ли сообщения?
5. Напишите в консоль: `console.log('Players:', otherPlayers.size)`

**Скопируйте результаты консоли сюда!**
