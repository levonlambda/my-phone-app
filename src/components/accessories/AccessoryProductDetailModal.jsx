import PropTypes from 'prop-types';
import {
  X,
  Tag,
  Edit,
  Image as ImageIcon,
  Hash,
  Barcode as BarcodeIcon,
  FileText,
  Factory
} from 'lucide-react';

const AccessoryProductDetailModal = ({ isOpen, product, onClose, onEdit }) => {
  if (!isOpen || !product) return null;

  const tags = Array.isArray(product.tags) ? product.tags : [];
  const isActive = product.active !== false;
  const sku = product.internalSku || product.id;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-[rgb(52,69,157)] px-6 py-4 flex justify-between items-start gap-4 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-white leading-tight">
              {product.manufacturer} {product.model}
            </h2>
            {product.shortDescription && (
              <p className="text-sm text-white/80 mt-0.5">{product.shortDescription}</p>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {product.category && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-white/15 text-white/95 text-xs font-medium">
                  {product.category}
                </span>
              )}
              {!isActive && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-500/90 text-white text-xs font-medium">
                  Inactive
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-lg p-1 flex-shrink-0 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* Hero image */}
          <div className="bg-gradient-to-b from-gray-50 to-white px-6 py-6 border-b">
            <div className="flex justify-center">
              {product.photoUrl ? (
                <div className="bg-white rounded-lg border shadow-sm p-3 max-w-xs w-full">
                  <img
                    src={product.photoUrl}
                    alt={product.model}
                    className="w-full h-60 object-contain"
                  />
                </div>
              ) : (
                <div className="w-full max-w-xs h-60 bg-white border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400">
                  <ImageIcon className="h-10 w-10 mb-2" />
                  <span className="text-sm">No Image</span>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-5 space-y-6">
            {/* Identifier strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="border rounded-lg px-3 py-2.5 bg-gray-50">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                  <Hash className="h-3 w-3" />
                  <span>Internal SKU</span>
                </div>
                <p className="text-sm font-mono font-semibold text-gray-800 mt-1 truncate">
                  {sku}
                </p>
              </div>
              <div className="border rounded-lg px-3 py-2.5 bg-gray-50">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                  <BarcodeIcon className="h-3 w-3" />
                  <span>Barcode</span>
                </div>
                <p
                  className={`text-sm mt-1 truncate ${
                    product.barcode ? 'font-mono font-semibold text-gray-800' : 'italic text-gray-400'
                  }`}
                >
                  {product.barcode || 'not set'}
                </p>
              </div>
              <div className="border rounded-lg px-3 py-2.5 bg-gray-50">
                <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gray-500 font-semibold">
                  <Factory className="h-3 w-3" />
                  <span>Status</span>
                </div>
                <p className="mt-1">
                  {isActive ? (
                    <span className="inline-flex items-center px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 bg-gray-200 text-gray-700 rounded-full text-xs font-semibold">
                      Inactive
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-[rgb(52,69,157)]" />
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Tags
                </h3>
              </div>
              {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t, i) => (
                    <span
                      key={`${t}-${i}`}
                      className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-[rgb(52,69,157)]/10 text-[rgb(52,69,157)] rounded-full border border-[rgb(52,69,157)]/20"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No tags</p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-[rgb(52,69,157)]" />
                <h3 className="text-sm font-semibold text-gray-800 uppercase tracking-wide">
                  Description
                </h3>
              </div>
              {product.description ? (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">No description provided</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 border-t px-6 py-3 flex justify-end gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-white transition-colors text-sm font-medium"
          >
            Close
          </button>
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(product)}
              className="flex items-center gap-1.5 px-4 py-2 bg-[rgb(52,69,157)] text-white rounded-lg hover:bg-[rgb(52,69,157)]/90 transition-colors text-sm font-medium"
            >
              <Edit className="h-4 w-4" />
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

AccessoryProductDetailModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  product: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onEdit: PropTypes.func
};

export default AccessoryProductDetailModal;
