import React, { useState, useEffect, useCallback } from 'react';
import { useImmer } from 'use-immer';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import './AnalysisBoard.css';

// A unique ID for new nodes
let nextId = 0;

const AnalysisBoard = () => {
  // The game tree now holds the entire game state
  const [tree, setTree] = useImmer({
    id: 'root',
    san: null,
    comment: '',
    fen: new Chess().fen(),
    ply: -1,
    children: [],
  });

  // currentPath tracks the location within the tree (e.g., [0, 1])
  const [currentPath, setCurrentPath] = useState([]);
  
  // State for the PGN text area
  const [pgnInput, setPgnInput] = useState('');

  // Find a node in the tree by its path
  const getNode = useCallback((path, sourceTree = tree) => {
    let node = sourceTree;
    for (const index of path) {
      node = node.children[index];
    }
    return node;
  }, [tree]);

  // Get the FEN for a given path by replaying moves
  const getFenForPath = useCallback((path) => {
    const game = new Chess();
    let currentNode = tree;
    for (const index of path) {
        currentNode = currentNode.children[index];
        game.move(currentNode.san);
    }
    return game.fen();
  }, [tree]);

  const currentNode = getNode(currentPath);
  const gameFen = getFenForPath(currentPath);

  function onDrop(sourceSquare, targetSquare) {
    const game = new Chess(gameFen);
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    if (!move) return false;

    setTree(draft => {
      const parentNode = getNode(currentPath, draft);
      const newNode = {
        id: nextId++,
        move,
        san: move.san,
        comment: '',
        fen: game.fen(),
        ply: parentNode.ply + 1,
        children: [],
      };
      
      // Check if this move already exists as a variation
      const existingChildIndex = parentNode.children.findIndex(child => child.san === newNode.san);

      if (existingChildIndex !== -1) {
        // If it exists, we just navigate to it
        setCurrentPath([...currentPath, existingChildIndex]);
      } else {
        // If it's a new move, add it as a new variation/child
        parentNode.children.push(newNode);
        setCurrentPath([...currentPath, parentNode.children.length - 1]);
      }
    });
    return true;
  }

  const navigateToPath = (path) => {
    setCurrentPath(path);
    const node = getNode(path);
    setComment(node.comment || '');
  };
  
  const [comment, setComment] = useState(currentNode.comment || '');

  const handleCommentChange = (e) => {
    const newComment = e.target.value;
    setComment(newComment);
    setTree(draft => {
      getNode(currentPath, draft).comment = newComment;
    });
  };

  const handlePgnInputChange = (event) => {
    setPgnInput(event.target.value);
  };
  
  const handleLoadPgn = () => {
    try {
        const chess = new Chess();
        chess.loadPgn(pgnInput);

        const buildTree = (history) => {
            let tree = { id: 'root', fen: new Chess().fen(), ply: -1, children: [] };
            let currentNode = tree;

            history.forEach(move => {
                const newNode = {
                    id: nextId++,
                    san: move.san,
                    comment: move.comment || '',
                    fen: move.after,
                    ply: currentNode.ply + 1,
                    children: [],
                    // We can add RAV (variations) parsing here later
                };
                currentNode.children.push(newNode);
                currentNode = newNode;
            });
            return tree;
        }
        
        console.log(`chess history: ${JSON.stringify(chess.history({ verbose: true }))}`);
        const newTree = buildTree(chess.history({ verbose: true }));
        setTree(newTree);
        setCurrentPath([]);

    } catch (error) {
        console.error("Invalid PGN:", error);
        alert("The PGN is invalid and could not be loaded.");
    }
  };
  
  const handleCopyPgn = () => {
    navigator.clipboard.writeText(pgnInput).then(() => {
        alert("PGN copied to clipboard!");
    }, (err) => {
        console.error('Could not copy PGN: ', err);
    });
  };

  const [contextMenu, setContextMenu] = useState(null);

  useEffect(() => {
    const handleOutsideClick = () => setContextMenu(null);
    if (contextMenu) window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [contextMenu]);

  const handleContextMenu = (event, path) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, path });
  };

  const handleDeleteMove = () => {
    if (!contextMenu) return;
    const { path } = contextMenu;
    setContextMenu(null);

    if (window.confirm('Are you sure you want to delete this move and all subsequent moves?')) {
      const parentPath = path.slice(0, -1);
      const childIndex = path[path.length - 1];
      
      setTree(draft => {
        const parentNode = getNode(parentPath, draft);
        parentNode.children.splice(childIndex, 1);
      });
      
      navigateToPath(parentPath);
    }
  };

  const handlePromoteVariation = () => {
    if (!contextMenu) return;
    const { path } = contextMenu;
    setContextMenu(null);
    
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1];

    if (childIndex === 0) return; // Already the main line

    setTree(draft => {
        const parentNode = getNode(parentPath, draft);
        const [variation] = parentNode.children.splice(childIndex, 1);
        parentNode.children.unshift(variation);
    });
    // The path of the promoted move is now [..., 0]
    navigateToPath([...parentPath, 0]);
  };

  const [pgn, setPgn] = useState('');

  const generatePgnRecursive = useCallback((node) => {
    if (!node || !node.children || node.children.length === 0) {
        return '';
    }

    let pgnString = '';
    const mainLine = node.children[0];
    const variations = node.children.slice(1);

    // Add move number for white's move.
    if (mainLine.ply % 2 === 0) {
        pgnString += `${mainLine.ply / 2 + 1}. `;
    }

    pgnString += `${mainLine.san} `;
    if (mainLine.comment) pgnString += `{ ${mainLine.comment} } `;
    
    // Add variations
    variations.forEach(variation => {
        const variationGame = new Chess(node.fen);
        variationGame.move(variation.san);
        
        let variationPgn = '';
        if (variation.ply % 2 !== 0) {
             variationPgn += `${Math.floor(variation.ply / 2) + 1}... `;
        }
        variationPgn += `${variation.san} `;
        if (variation.comment) variationPgn += `{ ${variation.comment} } `;
        variationPgn += generatePgnRecursive(variation);

        pgnString += `(${variationPgn.trim()}) `;
    });
    
    // Recurse down the main line
    pgnString += generatePgnRecursive(mainLine);
    return pgnString;
  }, []);

  useEffect(() => {
    const pgnString = generatePgnRecursive(tree);
    setPgnInput(pgnString.trim() + ' *');
  }, [tree, generatePgnRecursive]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft') {
        if (currentPath.length > 0) {
          navigateToPath(currentPath.slice(0, -1));
        }
      } else if (event.key === 'ArrowRight') {
        const node = getNode(currentPath);
        if (node.children.length > 0) {
          navigateToPath([...currentPath, 0]); // Go to main line
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPath, getNode, navigateToPath]);

  const MoveRenderer = ({ node, path, isVariation, ...props }) => {
    const isSelected = JSON.stringify(path) === JSON.stringify(props.currentPath);
    const variations = node.children.slice(1);
    
    // Recursive function to render a full line of moves
    const renderLine = (lineNode, linePath, isBranch) => {
        if (!lineNode) return null;
        
        const lineIsSelected = JSON.stringify(linePath) === JSON.stringify(props.currentPath);
        const moveNumber = Math.floor(lineNode.ply / 2) + 1;
        const showMoveNumber = lineNode.ply % 2 === 0 || isBranch;

        return (
            <>
                <span className="move-wrapper">
                    {showMoveNumber && (
                        <span className="move-number">
                            {moveNumber}.{lineNode.ply % 2 !== 0 ? '..' : ''}
                        </span>
                    )}
                    <span
                        className={`move ${lineIsSelected ? 'selected-move' : ''}`}
                        onClick={() => props.navigateToPath(linePath)}
                        onContextMenu={(e) => props.handleContextMenu(e, linePath)}
                    >
                        {lineNode.san}
                    </span>
                </span>
                {lineNode.children.length > 0 && renderLine(lineNode.children[0], [...linePath, 0], false)}
            </>
        )
    }

    return (
        <span className="move-group">
            <span
                className={`move ${isSelected ? 'selected-move' : ''}`}
                onClick={() => props.navigateToPath(path)}
                onContextMenu={(e) => props.handleContextMenu(e, path)}
            >
                {node.san}
            </span>
            
            {variations.length > 0 && (
                <span className="variations-inline">
                    {variations.map((variationNode, index) => (
                        <span key={variationNode.id} className="variation-inline">
                            (
                                {renderLine(variationNode, [...path.slice(0, -1), index + 1], true)}
                            )
                        </span>
                    ))}
                </span>
            )}
        </span>
    );
  };

  const MovesDisplay = ({ tree, ...props }) => {
    const mainLine = [];
    let current = tree;
    let path = [];
    while (current && current.children.length > 0) {
        const mainMoveNode = current.children[0];
        path.push(0);
        mainLine.push({ node: mainMoveNode, path: [...path] });
        current = mainMoveNode;
    }

    const rows = [];
    for (let i = 0; i < mainLine.length; i += 2) {
        const white = mainLine[i];
        const black = mainLine[i + 1];

        const hasWhiteComment = white.node.comment && white.node.comment.length > 0;
        const hasBlackComment = black && black.node.comment && black.node.comment.length > 0;
        
        if (hasWhiteComment || hasBlackComment) {
            // Render on separate lines if there are comments
            rows.push(
                <div key={`${i}-w`} className="move-row">
                    <span className="move-number">{Math.floor(white.node.ply / 2) + 1}.</span>
                    <span className="move-pair">
                        <MoveRenderer node={white.node} path={white.path} {...props} />
                    </span>
                    <span className="move-pair empty-move">...</span>
                </div>
            );
            if(hasWhiteComment) rows.push(<div key={`${i}-wc`} className="comment-row"><div className="comment">{white.node.comment}</div></div>);

            if(black) {
                rows.push(
                    <div key={`${i}-b`} className="move-row">
                        <span className="move-number"></span>
                        <span className="move-pair empty-move">...</span>
                        <span className="move-pair">
                            <MoveRenderer node={black.node} path={black.path} {...props} />
                        </span>
                    </div>
                );
                if(hasBlackComment) rows.push(<div key={`${i}-bc`} className="comment-row"><div className="comment">{black.node.comment}</div></div>);
            }
        } else {
             // Render on the same line if no comments
            rows.push(
                <div key={i} className="move-row">
                    <span className="move-number">{Math.floor(white.node.ply / 2) + 1}.</span>
                    <span className="move-pair">
                        <MoveRenderer node={white.node} path={white.path} {...props} />
                    </span>
                    <span className="move-pair">
                        {black && <MoveRenderer node={black.node} path={black.path} {...props} />}
                    </span>
                </div>
            );
        }
    }
    return <div>{rows}</div>;
  };
  
  return (
    <>
      <div className="analysis-board-container">
        <div className="analysis-board">
          <Chessboard position={gameFen} onPieceDrop={onDrop} />
        </div>
        <div className="move-history">
          <h2>Moves</h2>
          <div className="moves-list">
             <MovesDisplay tree={tree} currentPath={currentPath} navigateToPath={navigateToPath} handleContextMenu={handleContextMenu} />
          </div>
          {currentNode.children.length > 1 && (
            <div className="branch-selection">
              <h4>Variations</h4>
              {currentNode.children.map((child, index) => (
                <button key={child.id} onClick={() => navigateToPath([...currentPath, index])}>
                  {child.san}
                </button>
              ))}
            </div>
          )}
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
        <div className="pgn-header">
            <h3>Live PGN</h3>
            <button onClick={handleCopyPgn} className="pgn-button">Copy</button>
        </div>
        <textarea 
            value={pgnInput}
            onChange={handlePgnInputChange}
            className="pgn-textarea"
        />
        <button onClick={handleLoadPgn} className="pgn-button load-pgn-button">Load PGN from Text</button>
      </div>
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="context-menu-item" onClick={handleDeleteMove}>Delete</div>
          <div className="context-menu-item" onClick={handlePromoteVariation}>Promote variation</div>
        </div>
      )}
    </>
  );
};

export default AnalysisBoard; 