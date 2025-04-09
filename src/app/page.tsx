import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 bg-gradient-to-br from-white to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="max-w-4xl w-full text-center space-y-8">
        <h1 className="text-5xl md:text-6xl font-bold text-green-500 font-heading">
          Welcome to Bunkr
        </h1>
        
        <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto font-body">
          The ultimate social platform for golf enthusiasts. Connect with fellow golfers, track your scores, and improve your game.
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link href="/register" className="inline-block">
            <Button size="lg" className="w-full">Sign Up</Button>
          </Link>
          <Link href="/login" className="inline-block">
            <Button size="lg" variant="outline" className="w-full">Log In</Button>
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Track Your Scores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Log your rounds, track your progress, and see your handicap improve over time.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Connect with Golfers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Find golf buddies, join groups, and share your golfing experiences.
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Improve Your Game</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 dark:text-gray-300">
                Get detailed stats and insights to identify strengths and areas for improvement.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}