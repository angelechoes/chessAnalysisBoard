import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useImmer } from 'use-immer';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { parse } from '@mliebelt/pgn-parser';
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

  useEffect( _=> {
    console.log(`printing tree`);
    console.log(tree);
    console.log(`currentPath: ${currentPath}`);
  }, [tree])

  // currentPath tracks the location within the tree (e.g., [0, 1])
  const [currentPath, setCurrentPath] = useState([]);
  
  // State for the PGN text area
  const [pgnInput, setPgnInput] = useState('');
  
  // Ref for the moves list container to enable auto-scrolling
  const movesListRef = useRef(null);

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
    console.log(`chess _history before move is ${JSON.stringify(game._history)}`);
    
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    });

    console.log(`chess _history after move is ${JSON.stringify(game._history)}`);

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
      // The pgn-parser library returns null for an empty string.
      if (!pgnInput) return;

      // Use the new library to parse the PGN string into a structured object (Abstract Syntax Tree)
      const pgnAst = parse(pgnInput, { startRule: 'game' });
      
      if (!pgnAst || pgnAst.moves.length === 0) {
        alert('Could not parse any moves from the PGN.');
        return;
      }

      setTree(draft => {
        // Reset the initial tree state
        draft.id = 'root';
        draft.san = null;
        draft.comment = '';
        draft.fen = new Chess().fen();
        draft.ply = -1;
        draft.children = [];
        
        // This recursive function walks the parsed PGN's Abstract Syntax Tree
        const addMovesToNode = (currentParentNode, moves) => {
          if (!moves || moves.length === 0) {
            return;
          }

          let lastNodeForThisLine = currentParentNode;

          for (const move of moves) {
            const game = new Chess(lastNodeForThisLine.fen);
            const moveResult = game.move(move.notation.notation);
            
            if (moveResult) {
              const newNode = {
                id: nextId++,
                move: moveResult,
                san: moveResult.san,
                // Comments can be before or after a move, so we combine them.
                comment: [
                  ...(move.commentBefore ? [move.commentBefore] : []),
                  ...(move.commentMove ? [move.commentMove] : []),
                  ...(move.commentAfter ? [move.commentAfter] : [])
                ].join(' ').trim(),
                fen: game.fen(),
                ply: lastNodeForThisLine.ply + 1,
                children: [],
              };
              lastNodeForThisLine.children.push(newNode);

              // Variations are direct children of the move they are an alternative to.
              if (move.variations) {
                move.variations.forEach(variation => {
                  addMovesToNode(lastNodeForThisLine, variation);
                });
              }
              
              // The next move in the main line follows the node we just added.
              lastNodeForThisLine = newNode;
            }
          }
        };
        
        // Start building the tree from the root node using the parsed moves
        addMovesToNode(draft, pgnAst.moves);
      });

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
        event.preventDefault(); // Prevent default horizontal scrolling
        if (currentPath.length > 0) {
          navigateToPath(currentPath.slice(0, -1));
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault(); // Prevent default horizontal scrolling
        const node = getNode(currentPath);
        if (node.children.length > 0) {
          navigateToPath([...currentPath, 0]); // Go to main line
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPath, getNode, navigateToPath]);

  // Auto-scroll to keep the selected move centered
  useEffect(() => {
    if (currentPath.length > 0 && movesListRef.current) {
      // Use setTimeout to ensure the DOM has updated after the move selection
      setTimeout(() => {
        const moveId = `move-${currentPath.join('-')}`;
        console.log(`moveId: ${moveId}`);
        const moveElement = document.getElementById(moveId);
        console.log(`moveElement: ${moveElement}`);

        if (moveElement && movesListRef.current) {
          const container = movesListRef.current;
          const containerRect = container.getBoundingClientRect();
          const elementRect = moveElement.getBoundingClientRect();
          
          // Calculate the relative position of the element within the container
          const elementTop = elementRect.top - containerRect.top + container.scrollTop;
          const elementHeight = elementRect.height;
          const containerHeight = container.clientHeight;
          
          // Calculate scroll position to center the element
          const scrollTop = elementTop - (containerHeight / 2) + (elementHeight / 2);
          
          container.scrollTo({
            top: scrollTop,
            behavior: 'smooth'
          });
        }
      }, 50);
    }
  }, [currentPath]);

  const MoveRenderer = ({ node, path, isVariation, showMoveNumber, ...props }) => {
    const isSelected = JSON.stringify(path) === JSON.stringify(props.currentPath);
    const moveNumber = Math.floor(node.ply / 2) + 1;
    const moveId = `move-${path.join('-')}`;

    return (
        <span className="move-wrapper" id={moveId}>
            {showMoveNumber && (
                <span className="move-number">
                    {moveNumber}.{node.ply % 2 !== 0 ? '..' : ''}
                </span>
            )}
            <span
                className={`move ${isSelected ? 'selected-move' : ''}`}
                onClick={() => props.navigateToPath(path)}
                onContextMenu={(e) => props.handleContextMenu(e, path)}
            >
                {node.san}
            </span>
        </span>
    );
  };

  const VariationRenderer = ({ variations, basePath, depth = 1, ...props }) => {
    if (!variations || variations.length === 0) return null;

    const renderVariationLine = (lineNode, linePath) => {
        if (!lineNode) return null;
        
        const elements = [];
        let currentNode = lineNode;
        let currentPath = linePath;
        
        while (currentNode) {
            const shouldShowMoveNumber = currentNode.ply % 2 === 0 || currentNode === lineNode;
            elements.push(
                <MoveRenderer 
                    key={currentNode.id}
                    node={currentNode} 
                    path={currentPath} 
                    isVariation={true}
                    showMoveNumber={shouldShowMoveNumber}
                    {...props} 
                />
            );
            
            if (currentNode.comment && currentNode.comment.trim()) {
                elements.push(
                    <span key={`comment-${currentNode.id}`} className="inline-comment">
                        {` ${currentNode.comment.trim()} `}
                    </span>
                );
            }
            
            // Handle sub-variations within this line
            if (currentNode.children.length > 1) {
                const subVariations = currentNode.children.slice(1);
                elements.push(
                    <span key={`subvar-${currentNode.id}`} className="sub-variations">
                        <VariationRenderer 
                            variations={subVariations} 
                            basePath={currentPath}
                            depth={depth + 1}
                            {...props} 
                        />
                    </span>
                );
            }
            
            if (currentNode.children.length > 0) {
                currentPath = [...currentPath, 0];
                currentNode = currentNode.children[0];
            } else {
                break;
            }
        }
        
        return elements;
    };

    return (
        <div className="variations-block">
            {variations.map((variationNode, index) => {
                const variationPath = [...basePath, index + 1];
                return (
                    <div key={variationNode.id} className={`variation-line depth-${depth}`}>
                        {renderVariationLine(variationNode, variationPath)}
                    </div>
                );
            })}
        </div>
    );
  };

  const MovesDisplay = ({ tree, ...props }) => {
    const mainLine = [];
    let current = tree;
    let path = [];
    while (current && current.children.length > 0) {
        const mainMoveNode = current.children[0];
        const parentNode = current;
        path.push(0);
        mainLine.push({ node: mainMoveNode, path: [...path], parentNode });
        current = mainMoveNode;
    }

    const rows = [];
    for (let i = 0; i < mainLine.length; i += 2) {
        const white = mainLine[i];
        const black = mainLine[i + 1];

        const hasWhiteComment = white.node.comment && white.node.comment.length > 0;
        const hasBlackComment = black && black.node.comment && black.node.comment.length > 0;
        const whiteHasVariations = white.parentNode && white.parentNode.children.length > 1;
        const blackHasVariations = black && black.parentNode && black.parentNode.children.length > 1;
        
        if (hasWhiteComment || hasBlackComment || whiteHasVariations || blackHasVariations) {
            // Render on separate lines if there are comments or variations
            rows.push(
                <div key={`${i}-w`} className="move-row">
                    <span className="move-number">{Math.floor(white.node.ply / 2) + 1}.</span>
                    <span className="move-pair">
                        <MoveRenderer node={white.node} path={white.path} showMoveNumber={false} {...props} />
                    </span>
                    <span className="move-pair empty-move">...</span>
                </div>
            );
            if(hasWhiteComment) rows.push(<div key={`${i}-wc`} className="comment-row"><div className="comment">{white.node.comment}</div></div>);
            if(whiteHasVariations) {
                const whiteVariations = white.parentNode.children.slice(1);
                const whiteBasePath = white.path.slice(0, -1);
                rows.push(<div key={`${i}-wv`}><VariationRenderer variations={whiteVariations} basePath={whiteBasePath} {...props} /></div>);
            }

            if(black) {
                rows.push(
                    <div key={`${i}-b`} className="move-row">
                        <span className="move-number"></span>
                        <span className="move-pair empty-move">...</span>
                        <span className="move-pair">
                            <MoveRenderer node={black.node} path={black.path} showMoveNumber={false} {...props} />
                        </span>
                    </div>
                );
                if(hasBlackComment) rows.push(<div key={`${i}-bc`} className="comment-row"><div className="comment">{black.node.comment}</div></div>);
                if(blackHasVariations) {
                    const blackVariations = black.parentNode.children.slice(1);
                    const blackBasePath = black.path.slice(0, -1);
                    rows.push(<div key={`${i}-bv`}><VariationRenderer variations={blackVariations} basePath={blackBasePath} {...props} /></div>);
                }
            }
        } else {
             // Render on the same line if no comments or variations
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
          <div className="comment-box">
            <textarea
              value={comment}
              onChange={handleCommentChange}
              placeholder="Add a comment to the current move..."
            />
          </div>
        </div>
        <div className="move-history">
          <div className="moves-list" ref={movesListRef}>
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