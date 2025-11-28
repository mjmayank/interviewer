import { NextResponse } from 'next/server';
import { primaryQuestions } from '../../config/questions';

export async function GET() {
  try {
    return NextResponse.json({ questions: primaryQuestions });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

