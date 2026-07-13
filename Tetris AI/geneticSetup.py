import numpy as np
from copy import deepcopy


class Genetic_AI:
    def __init__(self, weights=None):
        if weights is None:
            self.weights = np.random.uniform(-1, 1, 4)
        else:
            self.weights = np.array(weights, dtype=float)

    def _compute_features(self, board):
        heights = board.heights
        aggregate_height = float(sum(heights))

        complete_lines = float(sum(1 for w in board.widths if w == board.width))

        holes = 0
        for col in range(board.width):
            block_seen = False
            for row in range(board.height):
                if board.board[row][col]:
                    block_seen = True
                elif block_seen:
                    holes += 1
        holes = float(holes)

        bumpiness = 0.0
        for c in range(board.width - 1):
            bumpiness += abs(heights[c] - heights[c + 1])
        bumpiness = float(bumpiness)

        return np.array([aggregate_height, complete_lines, holes, bumpiness], dtype=float)

    def evaluate_board(self, board):
        features = self._compute_features(board)
        return float(np.dot(self.weights, features))

    def _generate_rotations(self, piece):
        rotations = []
        seen = set()
        current = piece

        for _ in range(4):
            body_t = tuple(sorted(current.body))
            if body_t in seen:
                break

            seen.add(body_t)
            rotations.append(current)
            current = current.get_next_rotation()

        return rotations

    def get_best_move(self, board, piece):
        best_score = -float("inf")
        best_x = 0
        best_piece = piece

        rotations = self._generate_rotations(piece)

        for rot_piece in rotations:
            min_x = -min(b[0] for b in rot_piece.body)
            max_x = board.width - 1 - max(b[0] for b in rot_piece.body)

            for x in range(min_x, max_x + 1):
                temp_board = deepcopy(board)

                y = temp_board.drop_height(rot_piece, x)
                result = temp_board.place(x, y, rot_piece)

                if isinstance(result, Exception):
                    continue

                temp_board.clear_rows()
                score = self.evaluate_board(temp_board)

                if score > best_score:
                    best_score = score
                    best_x = x
                    best_piece = rot_piece

        return best_x, best_piece
