import React, { useState, useEffect } from 'react';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './AnalysisBoard.css';

const AnalysisBoard = () => {
  const [game, setGame] = useState(new Chess());
  // The moves state will store the PGN history
  const [moves, setMoves] = useState([]);
  // The currentMove state will track the index of the move being viewed
  const [currentMove, setCurrentMove] = useState(-1);

  // Function to update the board to a specific move
  const navigateToMove = (moveIndex) => {
    const newGame = new Chess();
    // Replay moves from the start to the desired move
    for (let i = 0; i <= moveIndex; i++) {
      newGame.move(moves[i]);
    }
    setGame(newGame);
    setCurrentMove(moveIndex);
  };

  function onDrop(sourceSquare, targetSquare) {
    // If we're viewing a past move, we can't make a new one from here yet
    // (this will be where variations will be handled later)
    if (currentMove !== moves.length - 1) {
        // For now, let's just jump to the latest move before making a new one
        navigateToMove(moves.length - 1);
    }

    const newGame = new Chess(game.fen());
    try {
      const move = newGame.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q', // always promote to a queen for simplicity
      });

      // If the move is legal
      if (move) {
        setGame(newGame);
        const newMoves = [...moves, move];
        setMoves(newMoves);
        setCurrentMove(newMoves.length - 1);
        return true;
      }
    } catch (error) {
      console.log(error);
      return false;
    }
    return false;
  }
  
  // Effect for handling keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        const newMoveIndex = Math.max(currentMove - 1, -1);
        if (newMoveIndex === -1) {
          setGame(new Chess()); // Go to start
          setCurrentMove(-1);
        } else {
          navigateToMove(newMoveIndex);
        }
      } else if (event.key === 'ArrowRight') {
        const newMoveIndex = Math.min(currentMove + 1, moves.length - 1);
        if(newMoveIndex < moves.length) {
            navigateToMove(newMoveIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [moves, currentMove]);

  return (
    <div className="analysis-board-container">
      <div className="analysis-board">
        <Chessboard position={game.fen()} onPieceDrop={onDrop} />
      </div>
      <div className="move-history">
        <h2>Moves</h2>
        <div className="moves-list">
          {moves.map((move, index) => (
            <span
              key={index}
              className={`move ${currentMove === index ? 'selected-move' : ''}`}
              onClick={() => navigateToMove(index)}
            >
              {index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}{move.san}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalysisBoard; 