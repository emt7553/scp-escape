export class NeuralNetwork {
  private inputSize: number;
  private hiddenSize: number;
  private outputSize: number;
  public weights: number[][][];
  public biases: number[][];

  constructor(inputSize: number, hiddenSize: number, outputSize: number) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.weights = this.initializeWeights();
    this.biases = this.initializeBiases();
  }

  private initializeWeights(): number[][][] {
    const weights: number[][][] = [];
    // He initialization for input to hidden layer (ReLU activation)
    const heScale = Math.sqrt(2 / this.inputSize);
    weights.push(
      Array.from({ length: this.inputSize }, () =>
        Array.from(
          { length: this.hiddenSize },
          () => (Math.random() * 2 - 1) * heScale
        )
      )
    );

    // Xavier initialization for hidden to output layer (linear activation)
    const xavierScale = Math.sqrt(1 / this.hiddenSize);
    weights.push(
      Array.from({ length: this.hiddenSize }, () =>
        Array.from(
          { length: this.outputSize },
          () => (Math.random() * 2 - 1) * xavierScale
        )
      )
    );

    return weights;
  }

  private initializeBiases(): number[][] {
    return [
      Array(this.hiddenSize).fill(0), // Hidden layer biases
      Array(this.outputSize).fill(0), // Output layer biases
    ];
  }

  public forward(inputs: number[]): number[] {
    if (inputs.length !== this.inputSize) {
      throw new Error(`Input size must be ${this.inputSize}`);
    }

    // Calculate hidden layer activations
    const hidden = this.weights[0][0].map((_, i) =>
      this.relu(
        inputs.reduce((sum, val, j) => sum + val * this.weights[0][j][i], 0) +
          this.biases[0][i]
      )
    );

    // Calculate output layer activations
    return this.weights[1][0].map(
      (_, i) =>
        hidden.reduce((sum, val, j) => sum + val * this.weights[1][j][i], 0) +
        this.biases[1][i]
    );
  }

  private relu(x: number): number {
    return Math.max(0, x);
  }

  public mutate(mutationRate: number, mutationStrength: number = 0.1): void {
    // Mutate weights and biases for both layers
    this.weights.forEach((layer, layerIdx) => {
      layer.forEach((neuron, i) => {
        neuron.forEach((_, j) => {
          if (Math.random() < mutationRate) {
            this.weights[layerIdx][i][j] +=
              (Math.random() * 2 - 1) * mutationStrength;
          }
        });
      });
    });

    this.biases.forEach((layer, layerIdx) => {
      layer.forEach((_bias, i) => {
        if (Math.random() < mutationRate) {
          this.biases[layerIdx][i] +=
            (Math.random() * 2 - 1) * mutationStrength;
        }
      });
    });
  }

  public clone(): NeuralNetwork {
    const clone = new NeuralNetwork(
      this.inputSize,
      this.hiddenSize,
      this.outputSize
    );
    clone.weights = this.weights.map((layer) =>
      layer.map((neuron) => [...neuron])
    );
    clone.biases = this.biases.map((layer) => [...layer]);
    return clone;
  }
}
