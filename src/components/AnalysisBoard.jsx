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
  // This will store the generated PGN
  const [pgn, setPgn] = useState('');

  // This will store the comment for the current move.
  const [comment, setComment] = useState('');

  // Function to update the board to a specific move
  const navigateToMove = (moveIndex) => {
    const newGame = new Chess();
    // Replay moves from the start to the desired move
    for (let i = 0; i <= moveIndex; i++) {
      newGame.move(moves[i].move);
    }
    setGame(newGame);
    setCurrentMove(moveIndex);
    // When we navigate to a move, we'll update the comment box
    if (moveIndex >= 0) {
        setComment(moves[moveIndex].comment || '');
    } else {
        setComment('');
    }
  };

  function onDrop(sourceSquare, targetSquare) {
    // If we're viewing a past move, we can't make a new one from here yet
    // (this will be where variations will be handled later)
    if (currentMove !== moves.length - 1 && moves.length > 0) {
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
        // We'll store an object with the move and an empty comment
        const newMoves = [...moves, { move, comment: '' }];
        setMoves(newMoves);
        setCurrentMove(newMoves.length - 1);
        // Clear the comment box for the new move
        setComment('');
        return true;
      }
    } catch (error) {
      console.log(error);
      return false;
    }
    return false;
  }
  
  // This function will be called when the comment textarea changes.
  const handleCommentChange = (e) => {
    const newComment = e.target.value;
    setComment(newComment);
    if (currentMove >= 0) {
      const newMoves = [...moves];
      newMoves[currentMove].comment = newComment;
      setMoves(newMoves);
    }
  };

  // Effect to generate PGN whenever moves change
  useEffect(() => {
    let pgnString = '';
    moves.forEach((moveData, index) => {
      // Add move number for white's move
      if (index % 2 === 0) {
        pgnString += `${Math.floor(index / 2) + 1}. `;
      }

      pgnString += `${moveData.move.san} `;

      // Add the comment if it exists
      if (moveData.comment && moveData.comment.length > 0) {
        pgnString += `{ ${moveData.comment} } `;
      }
    });

    setPgn(pgnString.trim() + ' *');
  }, [moves]);

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
    <>
      <div className="analysis-board-container">
        <div className="analysis-board">
          <Chessboard position={game.fen()} onPieceDrop={onDrop} />
        </div>
        <div className="move-history">
          <h2>Moves</h2>
          <div className="moves-list">
            {Array.from({ length: Math.ceil(moves.length / 2) }).map((_, i) => {
              const moveNumber = i + 1;
              const whiteMoveIndex = i * 2;
              const blackMoveIndex = i * 2 + 1;
              const whiteMoveData = moves[whiteMoveIndex];
              const blackMoveData = moves[blackMoveIndex];

              if (!whiteMoveData) return null;

              const hasWhiteComment = whiteMoveData.comment && whiteMoveData.comment.length > 0;
              const hasBlackComment = blackMoveData && blackMoveData.comment && blackMoveData.comment.length > 0;

              // If either move has a comment, split them into separate blocks
              if (hasWhiteComment || hasBlackComment) {
                return (
                  <React.Fragment key={i}>
                    {/* White Move Block */}
                    <div className="move-row-block">
                      <div className="move-row">
                        <span className="move-number">{moveNumber}.</span>
                        <span
                          className={`move ${currentMove === whiteMoveIndex ? 'selected-move' : ''}`}
                          onClick={() => navigateToMove(whiteMoveIndex)}
                        >
                          {whiteMoveData.move.san}
                        </span>
                        <span className="move empty-move">...</span>
                      </div>
                      {hasWhiteComment && (
                        <div className="comment-row">
                          <div className="comment">{whiteMoveData.comment}</div>
                        </div>
                      )}
                    </div>

                    {/* Black Move Block */}
                    {blackMoveData && (
                      <div className="move-row-block">
                        <div className="move-row">
                           <span className="move-number" />
                           <span className="move empty-move">...</span>
                           <span
                            className={`move ${currentMove === blackMoveIndex ? 'selected-move' : ''}`}
                            onClick={() => navigateToMove(blackMoveIndex)}
                          >
                            {blackMoveData.move.san}
                          </span>
                        </div>
                        {hasBlackComment && (
                           <div className="comment-row">
                             <div className="comment">{blackMoveData.comment}</div>
                           </div>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              }
              
              // If no comments, render on a single line
              return (
                <div className="move-row" key={i}>
                  <span className="move-number">{moveNumber}.</span>
                  <span
                    className={`move ${currentMove === whiteMoveIndex ? 'selected-move' : ''}`}
                    onClick={() => navigateToMove(whiteMoveIndex)}
                  >
                    {whiteMoveData.move.san}
                  </span>
                  {blackMoveData ? (
                    <span
                      className={`move ${currentMove === blackMoveIndex ? 'selected-move' : ''}`}
                      onClick={() => navigateToMove(blackMoveIndex)}
                    >
                      {blackMoveData.move.san}
                    </span>
                  ) : (
                    <span className="move empty-move" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="comment-box">
              <h3>Comment</h3>
              <textarea
                  value={comment}
                  onChange={handleCommentChange}
                  placeholder="Add a comment to the current move..."
              />
          </div>
        </div>
      </div>
      <div className="pgn-display">
        <h3>Live PGN</h3>
        <pre>{pgn}</pre>
      </div>
    </>
  );
};

export default AnalysisBoard; 