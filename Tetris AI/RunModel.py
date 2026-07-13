import numpy as np
from geneticSetup import Genetic_AI
import time
weights = np.load("weights/best_overallOG.npy")
ai = Genetic_AI(weights)

from game import Game
game = Game(mode="genetic", agent=ai)
startTime = time.time()
game.run()
endTime = time.time()
totalTime = (endTime - startTime)/60
print(totalTime)