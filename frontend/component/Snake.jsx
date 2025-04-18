import { useState, useEffect, useCallback, useRef } from 'react';

const SnakeGame = () => {
  const GRID_SIZE = 20;
  const GAME_SPEED = 150;
  const INITIAL_LENGTH = 4;
  const GAME_DURATION = 30;

  const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
  };

  const INITIAL_SNAKE1 = Array(INITIAL_LENGTH).fill().map((_, i) => ({ x: 5, y: 10 - i }));
  const INITIAL_SNAKE2 = Array(INITIAL_LENGTH).fill().map((_, i) => ({ x: 15, y: 10 - i }));

  const [snake1, setSnake1] = useState(INITIAL_SNAKE1);
  const [snake2, setSnake2] = useState(INITIAL_SNAKE2);
  const [dir1, setDir1] = useState(DIRECTIONS.DOWN);
  const [dir2, setDir2] = useState(DIRECTIONS.DOWN);
  const [food, setFood] = useState({ x: 10, y: 10 });
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [winner, setWinner] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [timer, setTimer] = useState(GAME_DURATION);

  const gameLoopRef = useRef(null);
  const timerRef = useRef(null);

  const createFood = useCallback((snakes) => {
    const newFood = {
      x: Math.floor(Math.random() * GRID_SIZE),
      y: Math.floor(Math.random() * GRID_SIZE)
    };
    const isOnSnake = snakes.some(snake =>
      snake.some(segment => segment.x === newFood.x && segment.y === newFood.y)
    );
    return isOnSnake ? createFood(snakes) : newFood;
  }, []);

  const wrapPosition = useCallback((pos) => ({
    x: (pos.x + GRID_SIZE) % GRID_SIZE,
    y: (pos.y + GRID_SIZE) % GRID_SIZE
  }), []);

  const checkCollision = useCallback((head, snake) =>
    snake.some((segment, index) => index !== 0 && segment.x === head.x && segment.y === head.y)
  , []);

  const handleKeyDown = useCallback((event) => {
    if (gameOver) return;
    if (!gameStarted) setGameStarted(true);

    switch (event.key.toLowerCase()) {
      case 'w': if (dir1.y !== 1) setDir1(DIRECTIONS.UP); break;
      case 's': if (dir1.y !== -1) setDir1(DIRECTIONS.DOWN); break;
      case 'a': if (dir1.x !== 1) setDir1(DIRECTIONS.LEFT); break;
      case 'd': if (dir1.x !== -1) setDir1(DIRECTIONS.RIGHT); break;
      case 'arrowup': if (dir2.y !== 1) setDir2(DIRECTIONS.UP); break;
      case 'arrowdown': if (dir2.y !== -1) setDir2(DIRECTIONS.DOWN); break;
      case 'arrowleft': if (dir2.x !== 1) setDir2(DIRECTIONS.LEFT); break;
      case 'arrowright': if (dir2.x !== -1) setDir2(DIRECTIONS.RIGHT); break;
    }
  }, [dir1, dir2, gameOver, gameStarted]);

  const restartGame = useCallback(() => {
    setSnake1(INITIAL_SNAKE1);
    setSnake2(INITIAL_SNAKE2);
    setDir1(DIRECTIONS.DOWN);
    setDir2(DIRECTIONS.DOWN);
    setFood(createFood([INITIAL_SNAKE1, INITIAL_SNAKE2]));
    setScore1(0);
    setScore2(0);
    setGameOver(false);
    setWinner(null);
    setGameStarted(false);
    setTimer(GAME_DURATION);
  }, [createFood]);

  useEffect(() => {
    setFood(createFood([snake1, snake2]));
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!gameStarted || gameOver) return;

    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          setGameOver(true);
          setWinner(score1 > score2 ? 'Player 1' : score2 > score1 ? 'Player 2' : 'tie');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [gameStarted, gameOver, score1, score2]);

  useEffect(() => {
    if (gameOver || !gameStarted) return;

    gameLoopRef.current = setInterval(() => {
      let newHead1 = wrapPosition({ x: snake1[0].x + dir1.x, y: snake1[0].y + dir1.y });
      let newHead2 = wrapPosition({ x: snake2[0].x + dir2.x, y: snake2[0].y + dir2.y });

      const s1Self = checkCollision(newHead1, snake1);
      const s1HitS2 = checkCollision(newHead1, snake2);
      const s2Self = checkCollision(newHead2, snake2);
      const s2HitS1 = checkCollision(newHead2, snake1);
      const headOn = newHead1.x === newHead2.x && newHead1.y === newHead2.y;

      if (s1Self || s1HitS2 || s2Self || s2HitS1 || headOn) {
        setGameOver(true);
        if ((s1Self || s1HitS2) && (s2Self || s2HitS1) || headOn) {
          setWinner(score1 > score2 ? 'Player 1' : score2 > score1 ? 'Player 2' : 'tie');
        } else if (s1Self || s1HitS2) {
          setWinner('Player 1');
        } else {
          setWinner('Player 2');
        }
        return;
      }

      let newSnake1 = [newHead1, ...snake1];
      let newSnake2 = [newHead2, ...snake2];
      let newFood = food;

      if (newHead1.x === food.x && newHead1.y === food.y) {
        setScore1(p => p + 1);
      } else {
        newSnake1.pop();
      }

      if (newHead2.x === food.x && newHead2.y === food.y) {
        setScore2(p => p + 1);
      } else {
        newSnake2.pop();
      }

      if ((newHead1.x === food.x && newHead1.y === food.y) || (newHead2.x === food.x && newHead2.y === food.y)) {
        newFood = createFood([newSnake1, newSnake2]);
        setFood(newFood);
      }

      setSnake1(newSnake1);
      setSnake2(newSnake2);
    }, GAME_SPEED);

    return () => clearInterval(gameLoopRef.current);
  }, [snake1, snake2, dir1, dir2, food, gameOver, gameStarted, checkCollision, wrapPosition, createFood, score1, score2]);

  const renderGrid = () => {
    const grid = Array(GRID_SIZE).fill().map(() => Array(GRID_SIZE).fill(null));
    snake1.forEach(seg => { if (grid[seg.y]) grid[seg.y][seg.x] = { type: 'snake', color: 'bg-green-500' }; });
    snake2.forEach(seg => { if (grid[seg.y]) grid[seg.y][seg.x] = { type: 'snake', color: 'bg-blue-500' }; });
    if (grid[food.y]) grid[food.y][food.x] = { type: 'food' };
    return grid;
  };

  const grid = renderGrid();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-4 relative">
      {/* Score & Timer */}
      <div className="flex justify-between w-full max-w-md mb-2 text-xl font-bold">
        <div className="text-green-400">P1: {score1}</div>
        <div>{timer}s</div>
        <div className="text-blue-400">P2: {score2}</div>
      </div>

      {/* Game Grid */}
      <div className="relative">
        <div className="border-4 border-gray-700 bg-gray-900 inline-block">
          {grid.map((row, rowIndex) => (
            <div key={rowIndex} className="flex">
              {row.map((cell, colIndex) => {
                let cellClass = "w-6 h-6 border border-gray-800";

                if (cell) {
                  if (cell.type === 'snake') {
                    cellClass += ` ${cell.color}`;
                  } else if (cell.type === 'food') {
                    cellClass += " bg-red-500";
                  }
                } else {
                  cellClass += " bg-gray-900";
                }

                return <div key={`${rowIndex}-${colIndex}`} className={cellClass}></div>;
              })}
            </div>
          ))}
        </div>

        {/* Game Over Modal */}
        {gameOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60">
            <div className="bg-gray-800 p-6 rounded-lg text-center">
              <h2 className="text-2xl font-bold mb-4 text-white">
                {winner === 'tie' ? 'It\'s a tie!' : `${winner} wins!`}
              </h2>
              <button 
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
                onClick={restartGame}
              >
                Play Again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-4 text-center text-sm text-gray-400">
        <p>Player 1: W, A, S, D to move</p>
        <p>Player 2: Arrow keys to move</p>
      </div>

      {/* Restart Button */}
      <div className="mt-6">
        <button 
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-6 rounded"
          onClick={restartGame}
        >
          {gameStarted ? 'Restart Game' : 'Start Game'}
        </button>
      </div>
    </div>
  );
};

export default SnakeGame;