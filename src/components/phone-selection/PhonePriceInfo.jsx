{/* Part 1 Start - Imports and Dependencies */}
import PropTypes from 'prop-types';
import { calculateMarkup, calculateProfit } from './utils/phoneUtils';
{/* Part 1 End - Imports and Dependencies */}

{/* Part 2 Start - Component Definition */}
const PhonePriceInfo = ({
  dealersPrice,
  retailPrice,
  handleDealersPriceChange,
  handleRetailPriceChange
}) => {
{/* Part 2 End - Component Definition */}

{/* Part 3 Start - Helper Functions */}
  // Helper function to get display values for profit calculation
  // This ensures we don't try to calculate with empty values
  const getPriceForCalculation = (price) => {
    if (!price || price === '') return '0';
    return price;
  };
{/* Part 3 End - Helper Functions */}

{/* Part 4 Start - Component Render */}
  return (
    <div className="space-y-4 pt-2">
      <div className="flex gap-4">
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Dealers Price:</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={dealersPrice}
            onChange={handleDealersPriceChange}
            placeholder="0.00"
            required
          />
        </div>
        <div className="flex-1 space-y-2">
          <label className="block text-[rgb(52,69,157)] font-semibold">Retail Price:</label>
          <input 
            type="text" 
            className="w-full p-2 border rounded"
            value={retailPrice}
            onChange={handleRetailPriceChange}
            placeholder="0.00"
            required
          />
        </div>
      </div>
      
      {/* Markup and Profit calculations - only show if both prices have values */}
      {dealersPrice && retailPrice && dealersPrice !== '' && retailPrice !== '' && (
        <div className="flex gap-4">
          <div className="flex-1 space-y-2">
            <label className="block text-[rgb(52,69,157)] font-semibold">Markup:</label>
            <div className="w-full p-2 border rounded bg-gray-50">
              {calculateMarkup(getPriceForCalculation(dealersPrice), getPriceForCalculation(retailPrice))}%
            </div>
          </div>
          <div className="flex-1 space-y-2">
            <label className="block text-[rgb(52,69,157)] font-semibold">Profit:</label>
            <div className="w-full p-2 border rounded bg-gray-50">
              {calculateProfit(getPriceForCalculation(dealersPrice), getPriceForCalculation(retailPrice))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
{/* Part 4 End - Component Render */}

{/* Part 5 Start - PropTypes Validation */}
PhonePriceInfo.propTypes = {
  dealersPrice: PropTypes.string.isRequired,
  retailPrice: PropTypes.string.isRequired,
  handleDealersPriceChange: PropTypes.func.isRequired,
  handleRetailPriceChange: PropTypes.func.isRequired
};
{/* Part 5 End - PropTypes Validation */}

{/* Part 6 Start - Export */}
export default PhonePriceInfo;
{/* Part 6 End - Export */}