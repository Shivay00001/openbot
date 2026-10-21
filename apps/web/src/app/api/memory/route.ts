import { NextRequest, NextResponse } from 'next/server';
import { EpisodicMemoryEngine, ReinforcementLearningEngine } from '@openbot/core';

const episodicMemory = new EpisodicMemoryEngine();
const reinforcement = new ReinforcementLearningEngine();

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'default_user';
    const query = searchParams.get('query');

    if (query) {
      const episodes = await episodicMemory.searchSimilarEpisodes(query, userId);
      const lessons = await episodicMemory.getLessonsLearned(query, userId);
      return NextResponse.json({ success: true, episodes, lessons });
    }

    const episodes = await episodicMemory.getAllEpisodes(userId);
    const playbooks = reinforcement.getPlaybooks();
    return NextResponse.json({ success: true, episodes, playbooks });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, goal, steps, outcome, summary } = await req.json();

    if (action === 'record') {
      const evaluation = reinforcement.evaluateTrajectory(goal, steps || [], outcome || 'success');
      const episode = await episodicMemory.recordEpisode({
        userId: 'default_user',
        conversationId: 'active_session',
        goal,
        steps: steps || [],
        outcome: outcome || 'success',
        summary: summary || 'Completed by OpenBot Agent',
        rewardScore: evaluation.rewardScore,
        reflectionCritique: {
          strengths: evaluation.critique.strengths,
          weaknesses: evaluation.critique.weaknesses,
          lessonsLearned: evaluation.critique.recommendations,
        },
        tags: ['autonomous-task'],
        startedAt: Date.now() - 3000,
      });

      const playbook = reinforcement.distillToPlaybook(episode);

      return NextResponse.json({
        success: true,
        episode,
        evaluation,
        playbook,
      });
    }

    return NextResponse.json({ error: 'Invalid memory action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
