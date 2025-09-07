import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useImmer } from 'use-immer';
import { Chess } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { parse } from '@mliebelt/pgn-parser';
import { DocumentDuplicateIcon } from '@heroicons/react/24/outline';
import './AnalysisBoard.css';

// A unique ID for new nodes
let nextId = 0;

const AnalysisBoard = ({ 
  externalSettings = null,
  onSettingsChange = null,
  showExternalSettings = false,
  onToggleSettings = null,
  startingFen = null,
  startingPgn = null,
  onPgnChange = null,
  onError = null,
  enableFenInput = true,
  enablePgnBox = true,
  containerMode = 'standalone'
}) => {
  // FEN state for starting position
  // In embedded mode, keep the move panel the same height as the board
  const containerRef = useRef(null);
  const boardContainerRef = useRef(null);
  const [boardPixelHeight, setBoardPixelHeight] = useState(null);
  const [boardWidthPx, setBoardWidthPx] = useState(500);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedMoves, setCollapsedMoves] = useState(false);
  const lastBoardWidthRef = useRef(500);

  // Helper to report errors to parent component
  const reportError = useCallback((type, message, details = null) => {
    const error = { type, message, details };
    console.error('AnalysisBoard Error:', error);
    if (onError) {
      onError(error);
    }
  }, [onError]);

  useEffect(() => {
    if (containerMode !== 'embedded') {
      setBoardPixelHeight(null);
      return;
    }
    const el = boardContainerRef.current;
    if (!el) return;

    const update = () => setBoardPixelHeight(el.getBoundingClientRect().height);
    update();

    let ro;
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(() => update());
      ro.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    return () => {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', update);
    };
  }, [containerMode]);

  // Compute initial board width based on container when embedded
  useEffect(() => {
    if (containerMode !== 'embedded') return;
    const el = containerRef.current;
    if (!el) return;
    const compute = () => {
      const total = el.getBoundingClientRect().width;
      const desired = Math.min(560, Math.max(380, Math.round(total * 0.55)));
      setBoardWidthPx(desired);
      lastBoardWidthRef.current = desired;
    };
    compute();
    const onResize = () => compute();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [containerMode]);

  // Drag handlers for vertical resizer between board and moves
  const startResize = (event) => {
    if (containerMode !== 'embedded') return;
    event.preventDefault();
    setIsResizing(true);
    const startX = event.clientX;
    const el = containerRef.current;
    const rect = el ? el.getBoundingClientRect() : { width: 0 };
    const initial = boardWidthPx;
    const minBoard = 360;
    const minMoves = 300;
    const resizerW = 8;

    const onMove = (e) => {
      const delta = e.clientX - startX;
      let next = initial + delta;
      const total = rect.width;
      next = Math.max(minBoard, Math.min(next, total - minMoves - resizerW));
      setBoardWidthPx(next);
      lastBoardWidthRef.current = next;
      if (collapsedMoves) setCollapsedMoves(false);
    };
    const onUp = () => {
      setIsResizing(false);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const toggleCollapseMoves = () => {
    if (collapsedMoves) {
      setCollapsedMoves(false);
      setBoardWidthPx(lastBoardWidthRef.current || 500);
    } else {
      lastBoardWidthRef.current = boardWidthPx;
      setCollapsedMoves(true);
    }
  };
  const [fenInput, setFenInput] = useState('');
  const [currentStartingFen, setCurrentStartingFen] = useState(startingFen || new Chess().fen());

  // The game tree now holds the entire game state
  const [tree, setTree] = useImmer({
    id: 'root',
    san: null,
    comment: '',
    fen: currentStartingFen,
    ply: -1,
    children: [],
  });

  // useEffect( _=> {
  //   console.log(`printing tree`);
  //   console.log(tree);
  //   console.log(`currentPath: ${currentPath}`);
  // }, [tree])

  // currentPath tracks the location within the tree (e.g., [0, 1])
  const [currentPath, setCurrentPath] = useState([]);
  
  // State for the PGN text area
  const [pgnInput, setPgnInput] = useState('');
  
  // Ref for the moves list container to enable auto-scrolling
  const movesListRef = useRef(null);

  // Board orientation state
  const [boardOrientation, setBoardOrientation] = useState('white');

  // Settings state - use external settings if provided
  const [showSettings, setShowSettings] = useState(false);
  const [keyboardShortcuts, setKeyboardShortcuts] = useState({
    flipBoard: 'f',
    nextMove: 'j',
    previousMove: 'k',
    jumpToStart: 'ArrowUp',
    jumpToEnd: 'ArrowDown',
    toggleFen: 'F' // Shift+F
  });

  const [showFenInput, setShowFenInput] = useState(false);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  // Merge external settings over internal defaults so missing keys fall back
  const effectiveSettings = { ...keyboardShortcuts, ...(externalSettings || {}) };
  const effectiveShowSettings = showExternalSettings || showSettings;

  // Handle settings changes
  const handleSettingsChange = (newSettings) => {
    if (onSettingsChange) {
      onSettingsChange(newSettings);
    } else {
      setKeyboardShortcuts(newSettings);
    }
  };

  const handleToggleSettings = (show) => {
    if (onToggleSettings) {
      onToggleSettings(show);
    } else {
      setShowSettings(show);
    }
  };

  // Update starting FEN when prop changes
  useEffect(() => {
    if (startingFen && startingFen !== currentStartingFen) {
      setCurrentStartingFen(startingFen);
      // Reset the tree with the new starting position
      setTree({
        id: 'root',
        san: null,
        comment: '',
        fen: startingFen,
        ply: -1,
        children: [],
      });
      setCurrentPath([]);
    }
  }, [startingFen, currentStartingFen, setTree]);

  // Load starting PGN when prop changes
  useEffect(() => {
    if (startingPgn) {
      try {
        const pgnAst = parse(startingPgn, { startRule: 'game' });
        
        if (!pgnAst || pgnAst.moves.length === 0) {
          reportError('invalid_pgn', 'The provided PGN contains no valid moves', { pgn: startingPgn });
          return;
        }

        // Extract FEN from PGN tags if present
        let startingFenFromPgn = new Chess().fen(); // default starting position
        let pgnHasFenHeader = false;
        
        if (pgnAst.tags && pgnAst.tags.FEN) {
          pgnHasFenHeader = true;
          startingFenFromPgn = pgnAst.tags.FEN;
          
          // Validate the FEN from PGN header
          try {
            new Chess(startingFenFromPgn);
          } catch (fenError) {
            reportError('invalid_fen_in_pgn', 'The FEN position in the PGN header is invalid', { 
              fen: startingFenFromPgn, 
              error: fenError.message 
            });
            return;
          }
          
          // Check if startingFen prop conflicts with PGN's FEN header
          if (startingFen && startingFen !== startingFenFromPgn) {
            reportError('fen_pgn_conflict', 'The startingFen prop conflicts with the FEN header in the PGN', {
              providedFen: startingFen,
              pgnFen: startingFenFromPgn,
              pgn: startingPgn
            });
            return;
          }
        } else if (startingFen) {
          // PGN has no FEN header, use startingFen prop if provided
          startingFenFromPgn = startingFen;
        }

        // Validate that the first move in PGN is legal from the starting position
        try {
          const testGame = new Chess(startingFenFromPgn);
          const firstMove = pgnAst.moves[0];
          if (firstMove && firstMove.notation) {
            testGame.move(firstMove.notation.notation);
          }
        } catch (moveError) {
          reportError('invalid_pgn_moves', 'The first move in the PGN is not legal from the starting position', {
            startingFen: startingFenFromPgn,
            firstMove: pgnAst.moves[0]?.notation?.notation,
            error: moveError.message
          });
          return;
        }

        if (pgnAst && pgnAst.moves.length > 0) {
          setCurrentStartingFen(startingFenFromPgn);

          setTree(draft => {
            draft.id = 'root';
            draft.san = null;
            draft.comment = '';
            draft.fen = startingFenFromPgn;
            draft.ply = -1;
            draft.children = [];
            
            const addMovesToNode = (currentParentNode, moves) => {
              if (!moves || moves.length === 0) return;
              let lastNodeForThisLine = currentParentNode;

              for (const move of moves) {
                const game = new Chess(lastNodeForThisLine.fen);
                const moveResult = game.move(move.notation.notation);
                
                if (moveResult) {
                  const newNode = {
                    id: nextId++,
                    move: moveResult,
                    san: moveResult.san,
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

                  if (move.variations) {
                    move.variations.forEach(variation => {
                      addMovesToNode(lastNodeForThisLine, variation);
                    });
                  }
                  
                  lastNodeForThisLine = newNode;
                }
              }
            };
            
            addMovesToNode(draft, pgnAst.moves);
          });

          setCurrentPath([]);
          setPgnInput(startingPgn);
        }
      } catch (error) {
        reportError('pgn_parse_error', 'Failed to parse the starting PGN', { 
          pgn: startingPgn, 
          error: error.message 
        });
      }
    }
  }, [startingPgn, startingFen, setTree, reportError]);

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
    const game = new Chess(currentStartingFen);
    let currentNode = tree;
    for (const index of path) {
        currentNode = currentNode.children[index];
        game.move(currentNode.san);
    }
    return game.fen();
  }, [tree, currentStartingFen]);

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
        // Update comment for existing move
        setComment(parentNode.children[existingChildIndex].comment || '');
      } else {
        // If it's a new move, add it as a new variation/child
        parentNode.children.push(newNode);
        setCurrentPath([...currentPath, parentNode.children.length - 1]);
        // Clear comment for new move
        setComment('');
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
  
  // Load PGN from a given string (shared logic)
  const loadPgnFromString = (pgnString) => {
    console.log('pgnString is:', pgnString);
    try {
      // The pgn-parser library returns null for an empty string.
      if (!pgnString) return false;

      // Use the new library to parse the PGN string into a structured object (Abstract Syntax Tree)
      const pgnAst = parse(pgnString, { startRule: 'game' });
      console.log('pgnAst is:', pgnAst);
      
      if (!pgnAst || pgnAst.moves.length === 0) {
        reportError('invalid_pgn', 'Could not parse any moves from the PGN', { pgn: pgnString });
        return false;
      }

      // Extract FEN from PGN tags if present
      let startingFenFromPgn = new Chess().fen(); // default starting position
      if (pgnAst.tags && pgnAst.tags.FEN) {
        startingFenFromPgn = pgnAst.tags.FEN;
        setCurrentStartingFen(startingFenFromPgn);
      }

      setTree(draft => {
        // Reset the initial tree state
        draft.id = 'root';
        draft.san = null;
        draft.comment = '';
        draft.fen = startingFenFromPgn;
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
      return true;

    } catch (error) {
      reportError('pgn_parse_error', 'Failed to parse PGN', { pgn: pgnString, error: error.message });
      return false;
    }
  };

  const handleLoadPgn = () => {
    const success = loadPgnFromString(pgnInput);
    if (!success) {
      alert("The PGN is invalid and could not be loaded.");
    }
  };
  
  const [copyStatus, setCopyStatus] = useState('');

  const handleCopyPgn = () => {
    navigator.clipboard.writeText(pgnInput).then(() => {
        setCopyStatus('Copied!');
        setTimeout(() => setCopyStatus(''), 2000);
    }, (err) => {
        console.error('Could not copy PGN: ', err);
        setCopyStatus('Failed to copy');
        setTimeout(() => setCopyStatus(''), 2000);
    });
  };

  const handleFenInputChange = (event) => {
    setFenInput(event.target.value);
  };

  const handleLoadFen = () => {
    try {
      // Validate the FEN
      const chess = new Chess(fenInput);
      const newFen = chess.fen();
      
      setCurrentStartingFen(newFen);
      
      // Reset the tree with the new starting position
      setTree({
        id: 'root',
        san: null,
        comment: '',
        fen: newFen,
        ply: -1,
        children: [],
      });
      
      setCurrentPath([]);
      setFenInput(''); // Clear the input after successful load
      
    } catch (error) {
      console.error("Invalid FEN:", error);
      alert("The FEN is invalid and could not be loaded.");
    }
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
    
    // Check if we need to include the FEN header (when not starting from standard position)
    const standardStartingFen = new Chess().fen();
    let fullPgn = '';
    
    if (currentStartingFen !== standardStartingFen) {
      fullPgn = `[FEN "${currentStartingFen}"]\n\n`;
    }
    
    fullPgn += pgnString.trim();
    
    // Add game termination marker if there are no moves
    if (pgnString.trim() === '') {
      fullPgn = fullPgn === '' ? ' *' : fullPgn + ' *';
    } else if (!fullPgn.endsWith('*') && !fullPgn.match(/[10\/\-]$/)) {
      fullPgn += ' *';
    }
    
    setPgnInput(fullPgn);
    
    // Notify parent component of PGN changes
    if (onPgnChange) {
      onPgnChange(fullPgn);
    }
  }, [tree, generatePgnRecursive, onPgnChange, currentStartingFen]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      // Robustly detect if the user is typing in an editable field (use both event.target and document.activeElement)
      const isEditable = (el) => {
        if (!el || !el.tagName) return false;
        const tag = el.tagName;
        if (tag === 'TEXTAREA') return true;
        if (tag === 'INPUT') {
          const type = (el.getAttribute && el.getAttribute('type')) || 'text';
          const textLike = ['text','search','email','url','tel','password','number'];
          return textLike.includes(type.toLowerCase());
        }
        if (el.isContentEditable) return true;
        if (el.getAttribute && el.getAttribute('contenteditable') === 'true') return true;
        if (el.getAttribute && el.getAttribute('role') === 'textbox') return true;
        return false;
      };
      const isTypingInInput = isEditable(event.target) || isEditable(document.activeElement);

      // Handle Escape key
      if (event.key === 'Escape') {
        event.preventDefault();
        
        // If settings is open, close it
        if (effectiveShowSettings) {
          handleToggleSettings(false);
          return;
        }
        
        // If user is typing in an input field, defocus it
        if (isTypingInInput) {
          event.target.blur();
          return;
        }
      }

      // Check for settings shortcut (Cmd+, or Ctrl+,) - should work even when typing
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        handleToggleSettings(true);
        return;
      }

      // Don't handle other shortcuts when settings is open
      if (effectiveShowSettings) return;

      // Don't handle other shortcuts when user is typing in input fields
      if (isTypingInInput) return;

      // Handle FEN input toggle (Shift+F by default) - only if FEN input is enabled
      if (enableFenInput && event.key === effectiveSettings.toggleFen && event.shiftKey) {
        event.preventDefault();
        setShowFenInput(prev => !prev);
        return;
      }

      // Handle board flip (only if not shift+f)
      if (event.key.toLowerCase() === effectiveSettings.flipBoard.toLowerCase() && !event.shiftKey) {
        event.preventDefault();
        setBoardOrientation(prev => prev === 'white' ? 'black' : 'white');
        return;
      }

      // Handle jump to start
      if (event.key === effectiveSettings.jumpToStart) {
        event.preventDefault();
        navigateToPath([]);
        return;
      }

      // Handle jump to end
      if (event.key === effectiveSettings.jumpToEnd) {
        event.preventDefault();
        // Find the end of the main line
        let currentNode = tree;
        let endPath = [];
        while (currentNode.children.length > 0) {
          currentNode = currentNode.children[0]; // Always follow main line
          endPath.push(0);
        }
        navigateToPath(endPath);
        return;
      }

      // Handle move navigation
      if (event.key.toLowerCase() === effectiveSettings.previousMove.toLowerCase() || event.key === 'ArrowLeft') {
        event.preventDefault(); // Prevent default horizontal scrolling
        if (currentPath.length > 0) {
          navigateToPath(currentPath.slice(0, -1));
        }
      } else if (event.key.toLowerCase() === effectiveSettings.nextMove.toLowerCase() || event.key === 'ArrowRight') {
        event.preventDefault(); // Prevent default horizontal scrolling
        const node = getNode(currentPath);
        if (node.children.length > 0) {
          navigateToPath([...currentPath, 0]); // Go to main line
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
      }, [currentPath, getNode, navigateToPath, effectiveSettings, setBoardOrientation, effectiveShowSettings, handleToggleSettings]);

  // Auto-scroll to keep the selected move centered
  useEffect(() => {
    if (!autoScrollEnabled || !movesListRef.current) return;

    // Use setTimeout to ensure the DOM has updated after the move selection
    const timeoutId = setTimeout(() => {
      // Check if ref is still valid (component might have unmounted)
      if (!movesListRef.current) return;
      
      if (currentPath.length > 0) {
        // Scroll to selected move
        const moveId = `move-${currentPath.join('-')}`;
        const moveElement = document.getElementById(moveId);

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
      } else {
        // Jump to start - scroll to top
        if (movesListRef.current && movesListRef.current.scrollTo) {
          movesListRef.current.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      }
    }, 50);

    // Cleanup function to clear timeout if component unmounts or dependencies change
    return () => clearTimeout(timeoutId);
  }, [currentPath, autoScrollEnabled]);

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
      <div ref={containerRef} className={`analysis-board-container ${containerMode === 'embedded' ? 'embedded-mode' : 'standalone-mode'}`}>
        <div
          className="analysis-board"
          style={containerMode === 'embedded' ? {
            flex: collapsedMoves ? '1 1 auto' : '0 0 auto',
            flexBasis: collapsedMoves ? 'auto' : `${Math.round(boardWidthPx)}px`,
            width: collapsedMoves ? '100%' : `${Math.round(boardWidthPx)}px`
          } : undefined}
        >
          <div ref={boardContainerRef}>
            <Chessboard 
            position={gameFen} 
            onPieceDrop={onDrop} 
            boardOrientation={boardOrientation}
            />
          </div>
          <div className="comment-box">
            <textarea
              value={comment}
              onChange={handleCommentChange}
              placeholder="Add a comment to the current move..."
            />
          </div>
        </div>
        {containerMode === 'embedded' && !collapsedMoves && (
          <div
            className={`vertical-resizer${isResizing ? ' resizing' : ''}`}
            onMouseDown={startResize}
            onDoubleClick={toggleCollapseMoves}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize moves panel"
          />
        )}
        {!collapsedMoves && (
        <div className="move-history" style={containerMode === 'embedded' && boardPixelHeight ? { height: boardPixelHeight } : undefined}>
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
        )}
      </div>
      {enableFenInput && showFenInput && (
        <div className={`fen-display ${containerMode === 'embedded' ? 'embedded-mode' : 'standalone-mode'}`}>
          <div className="fen-header">
            <h3>Starting Position (FEN)</h3>
          </div>
          <div className="fen-input-container">
            <textarea 
              value={fenInput}
              onChange={handleFenInputChange}
              className="fen-textarea"
              placeholder="Paste FEN notation here to set a custom starting position..."
              rows="2"
            />
            <button onClick={handleLoadFen} className="fen-button load-fen-button">Load FEN</button>
          </div>
        </div>
      )}
      {enablePgnBox && (
        <div className={`pgn-display ${containerMode === 'embedded' ? 'embedded-mode' : 'standalone-mode'}`}>
          <div className="pgn-header">
              <h3>Live PGN</h3>
          </div>
          <div className="pgn-textarea-container">
            <textarea 
                value={pgnInput}
                onChange={handlePgnInputChange}
                className="pgn-textarea"
            />
            <button 
              onClick={handleCopyPgn} 
              className="pgn-copy-icon"
              title="Copy PGN"
            >
              <DocumentDuplicateIcon className="copy-icon-svg" />
            </button>
            {copyStatus && <div className="copy-status">{copyStatus}</div>}
          </div>
          <button onClick={handleLoadPgn} className="pgn-button load-pgn-button">Load PGN</button>
        </div>
      )}
      {contextMenu && (
        <div className="context-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
          <div className="context-menu-item" onClick={handleDeleteMove}>Delete</div>
          <div className="context-menu-item" onClick={handlePromoteVariation}>Promote variation</div>
        </div>
      )}
      {effectiveShowSettings && (
        <div className="settings-overlay" onClick={() => handleToggleSettings(false)}>
          <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="settings-header">
              <h2>Settings</h2>
              <button className="settings-close" onClick={() => handleToggleSettings(false)}>×</button>
            </div>
            <div className="settings-content">
              <div className="settings-section">
                <h3>Keyboard Shortcuts</h3>
                <div className="shortcut-item">
                  <label>Flip Board:</label>
                  <input
                    type="text"
                    value={effectiveSettings.flipBoard}
                    onChange={(e) => handleSettingsChange({
                      ...effectiveSettings,
                      flipBoard: e.target.value.toLowerCase()
                    })}
                    maxLength="1"
                  />
                </div>
                <div className="shortcut-item">
                  <label>Next Move:</label>
                  <input
                    type="text"
                    value={effectiveSettings.nextMove}
                    onChange={(e) => handleSettingsChange({
                      ...effectiveSettings,
                      nextMove: e.target.value.toLowerCase()
                    })}
                    maxLength="1"
                  />
                </div>
                <div className="shortcut-item">
                  <label>Previous Move:</label>
                  <input
                    type="text"
                    value={effectiveSettings.previousMove}
                    onChange={(e) => handleSettingsChange({
                      ...effectiveSettings,
                      previousMove: e.target.value.toLowerCase()
                    })}
                    maxLength="1"
                  />
                </div>
                <div className="shortcut-item">
                  <label>Jump to Start:</label>
                  <input
                    type="text"
                    value={effectiveSettings.jumpToStart === 'ArrowUp' ? '↑' : effectiveSettings.jumpToStart}
                    onChange={(e) => {
                      const value = e.target.value === '↑' ? 'ArrowUp' : e.target.value;
                      handleSettingsChange({
                        ...effectiveSettings,
                        jumpToStart: value
                      });
                    }}
                    maxLength="1"
                  />
                </div>
                <div className="shortcut-item">
                  <label>Jump to End:</label>
                  <input
                    type="text"
                    value={effectiveSettings.jumpToEnd === 'ArrowDown' ? '↓' : effectiveSettings.jumpToEnd}
                    onChange={(e) => {
                      const value = e.target.value === '↓' ? 'ArrowDown' : e.target.value;
                      handleSettingsChange({
                        ...effectiveSettings,
                        jumpToEnd: value
                      });
                    }}
                    maxLength="1"
                  />
                </div>
                {enableFenInput && (
                  <div className="shortcut-item">
                    <label>Toggle FEN Input:</label>
                    <span className="shortcut-display">Shift+F</span>
                  </div>
                )}
              </div>
              <div className="settings-section">
                <h3>Board Settings</h3>
                <div className="shortcut-item">
                  <label>Current Orientation:</label>
                  <span className="board-orientation">{boardOrientation === 'white' ? 'White' : 'Black'}</span>
                </div>
              </div>
              <div className="settings-section">
                <h3>UI Settings</h3>
                <div className="shortcut-item">
                  <label>Auto-scroll to keep selected move in view:</label>
                  <input
                    type="checkbox"
                    checked={autoScrollEnabled}
                    onChange={(e) => setAutoScrollEnabled(e.target.checked)}
                    className="checkbox-input"
                  />
                </div>
              </div>
              <div className="settings-footer">
                <p><strong>Tip:</strong> Press Cmd+, (or Ctrl+,) to open settings</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AnalysisBoard; 