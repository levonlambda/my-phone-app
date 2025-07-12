{/* Part 1 Start - Imports */}
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Battery, Camera, Cpu, Monitor, Palette } from 'lucide-react';
import PropTypes from 'prop-types';
{/* Part 1 End - Imports */}

{/* Part 2 Start - Component Definition */}
const PhoneSpecCard = () => {
{/* Part 2 End - Component Definition */}

  {/* Part 3 Start - Static Data */}
  const phoneData = {
    manufacturer: "Samsung",
    model: "Galaxy S25 Ultra",
    released: "February 2025",
    weight: "218g",
    display: "AMOLED (120Hz)",
    resolution: "1440 x 3120 (498 ppi density)",
    protection: "Corning Gorilla Armor 2",
    os: "Android 15",
    chipset: "Qualcom SM8750-AB Snapdragon 8 Elite",
    cpu: "Qualcomm Oryon",
    gpu: "Qualcomm Adreno",
    storageAndRam: "256GB/ 12GB",
    rearCamera: "200MP + 10MP + 50MP + 50MP",
    frontCamera: "12MP",
    battery: "5,000 mAh",
    wiredCharging: "45W",
    wirelessCharging: "25W",
    colors: ["Titanium Silver Blue", "Titanium Black", "Titanium White Silver", "Titanium Gray"]
  };
  {/* Part 3 End - Static Data */}

  {/* Part 4 Start - Sub-component Definition */}
  const SpecRow = ({ label, value }) => (
    <div className="flex items-center py-0.5">
      <p className="text-[rgb(52,69,157)] w-40 text-base">{label}:</p>
      <p className="text-base">{value}</p>
    </div>
  );
  
  SpecRow.propTypes = {
    label: PropTypes.string.isRequired,
    value: PropTypes.string.isRequired
  };
  {/* Part 4 End - Sub-component Definition */}

  {/* Part 5 Start - Component Render */}
  return (
    <div className="min-h-screen bg-white p-4">
      <Card className="w-full max-w-[640px] mx-auto rounded-lg overflow-hidden shadow-[0_3px_10px_rgb(0,0,0,0.2)]">
        <CardHeader className="bg-[rgb(52,69,157)] py-3">
          <CardTitle className="text-2xl text-white">
            {phoneData.manufacturer} {phoneData.model}
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Badge className="bg-white rounded-md px-3 text-base" style={{ color: 'rgb(52,69,157)' }}>
              {phoneData.released}
            </Badge>
            <Badge variant="outline" className="border-white text-white rounded-md px-3 text-base">
              {phoneData.weight}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="bg-white p-4 space-y-4">
          {/* Display Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Monitor className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Display</h3>
            </div>
            <div>
              <SpecRow label="Type" value={phoneData.display} />
              <SpecRow label="Resolution" value={phoneData.resolution} />
              <SpecRow label="Protection" value={phoneData.protection} />
            </div>
          </div>

          {/* Performance Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Performance</h3>
            </div>
            <div>
              <SpecRow label="OS" value={phoneData.os} />
              <SpecRow label="Chipset" value={phoneData.chipset} />
              <SpecRow label="CPU" value={phoneData.cpu} />
              <SpecRow label="GPU" value={phoneData.gpu} />
              <SpecRow label="Storage & RAM" value={phoneData.storageAndRam} />
            </div>
          </div>

          {/* Camera Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Camera</h3>
            </div>
            <div>
              <SpecRow label="Rear Camera" value={phoneData.rearCamera} />
              <SpecRow label="Front Camera" value={phoneData.frontCamera} />
            </div>
          </div>

          {/* Battery Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Battery className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Battery</h3>
            </div>
            <div>
              <SpecRow label="Capacity" value={phoneData.battery} />
              <SpecRow label="Wired Charging" value={phoneData.wiredCharging} />
              <SpecRow label="Wireless Charging" value={phoneData.wirelessCharging} />
            </div>
          </div>

          {/* Colors Section */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Palette className="w-5 h-5 text-[rgb(52,69,157)]" />
              <h3 className="text-lg font-semibold">Available Colors</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {phoneData.colors.map((color, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="rounded-md px-3 text-sm" // Changed from text-base to text-sm
                  style={{ borderColor: 'rgb(52,69,157)', color: 'rgb(52,69,157)' }}
                >
                  {color}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
{/* Part 5 End - Component Render */}

{/* Part 6 Start - Export */}
export default PhoneSpecCard;
{/* Part 6 End - Export */}