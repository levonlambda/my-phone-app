import PropTypes from 'prop-types';

const PhoneColorInfo = ({
  selectedColor,
  colors,
  handleColorChange
}) => {
  return (
    <div className="space-y-2">
      <label className="block text-[rgb(52,69,157)] font-semibold">Color:</label>
      <select 
        className="w-full p-2 border rounded"
        value={selectedColor}
        onChange={handleColorChange}
        required={colors.length > 0}
      >
        <option value="">-- Select Color --</option>
        {colors.map(color => (
          <option key={color} value={color}>
            {color}
          </option>
        ))}
      </select>
    </div>
  );
};

PhoneColorInfo.propTypes = {
  selectedColor: PropTypes.string.isRequired,
  colors: PropTypes.array.isRequired,
  handleColorChange: PropTypes.func.isRequired
};

export default PhoneColorInfo;