import PropTypes from 'prop-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

/**
 * Shared placeholder shown for Accessories feature views that are scaffolded
 * but not yet implemented. Removed (or replaced) as each phase lands.
 */
const ComingSoonCard = ({ title, phase }) => {
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-4xl mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white flex items-center">
            <Construction className="h-6 w-6 mr-2" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="text-center text-gray-600">
            <Construction className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-700">Coming soon</p>
            <p className="text-sm mt-2">
              This view is part of the Accessories Management feature and will be
              implemented in {phase}.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

ComingSoonCard.propTypes = {
  title: PropTypes.string.isRequired,
  phase: PropTypes.string.isRequired
};

export default ComingSoonCard;
