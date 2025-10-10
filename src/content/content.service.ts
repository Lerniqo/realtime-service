import { Injectable } from '@nestjs/common';

@Injectable()
export class ContentService {
  async getMatchQuestions() {
    return {
      questions: [
        {
          id: 1,
          question: 'Simplify: 3x + 5x - 2',
          options: ['5x - 2', '8x - 2', '8x + 2', '2x + 5'],
          answer: '8x - 2',
        },
        {
          id: 2,
          question: 'What is the value of (2² + 3²)?',
          options: ['9', '10', '12', '13'],
          answer: '13',
        },
        {
          id: 3,
          question:
            'Find the area of a rectangle with length 8 cm and width 3 cm.',
          options: ['11 cm²', '24 cm²', '22 cm²', '18 cm²'],
          answer: '24 cm²',
        },
        {
          id: 4,
          question: 'If y = 2x + 1 and x = 3, what is y?',
          options: ['5', '6', '7', '8'],
          answer: '7',
        },
        {
          id: 5,
          question: 'What is the mean of 4, 6, 8, and 10?',
          options: ['6', '7', '8', '9'],
          answer: '7',
        },
      ],
    };
  }
}
