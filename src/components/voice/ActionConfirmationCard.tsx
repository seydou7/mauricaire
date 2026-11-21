import React from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Calendar,
  Clock,
  User,
  Heart,
  FlaskConical,
  Share2,
  MessageSquare,
  Check,
  Edit,
  X,
  AlertCircle,
  Loader2,
} from "lucide-react";

interface ActionConfirmationCardProps {
  intent: string;
  actionPreview: any;
  onConfirm: () => void;
  onModify: () => void;
  onCancel: () => void;
  isExecuting?: boolean;
}

export const ActionConfirmationCard: React.FC<ActionConfirmationCardProps> = ({
  intent,
  actionPreview,
  onConfirm,
  onModify,
  onCancel,
  isExecuting = false,
}) => {
  const { t } = useTranslation();

  if (!actionPreview) return null;

  const getIcon = () => {
    switch (intent) {
      case "RECORD_HEALTH_MEASUREMENT":
        return <Heart className="h-5 w-5 text-red-500" />;
      case "CREATE_HOMELAB_REQUEST":
        return <FlaskConical className="h-5 w-5 text-purple-600" />;
      case "CREATE_RELAY_REQUEST":
        return <Share2 className="h-5 w-5 text-teal-600" />;
      case "SEND_MESSAGE":
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      default:
        return <Calendar className="h-5 w-5 text-teal-600" />;
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-teal-500/30 p-4 shadow-md space-y-3.5 my-2">
      <div className="flex items-start justify-between gap-2 border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-teal-50 rounded-xl">{getIcon()}</div>
          <div>
            <h4 className="font-bold text-gray-900 text-sm">
              {actionPreview.title || t("voice_ai.action_confirmation_title", "Confirmation de l'action")}
            </h4>
            <span className="text-[11px] text-gray-500">
              {t("voice_ai.action_confirmation_desc", "Vérifiez les détails ci-dessous avant validation")}
            </span>
          </div>
        </div>
        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px]">
          {t("voice_ai.confirmation_required", "Confirmation requise")}
        </Badge>
      </div>

      <div className="bg-gray-50/80 rounded-xl p-3 text-xs space-y-2 border border-gray-100">
        {actionPreview.beneficiary && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-gray-400" />
              {t("voice_ai.beneficiary", "Bénéficiaire :")}
            </span>
            <span className="font-bold text-gray-900">{actionPreview.beneficiary}</span>
          </div>
        )}

        {actionPreview.service && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t("voice_ai.service", "Prestation / Soin :")}</span>
            <span className="font-semibold text-teal-700">{actionPreview.service}</span>
          </div>
        )}

        {actionPreview.valueFormatted && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500">{t("voice_ai.vital_recorded", "Constante relevée :")}</span>
            <span className="font-bold text-teal-700 text-sm">{actionPreview.valueFormatted}</span>
          </div>
        )}

        {actionPreview.dateFormatted && (
          <div className="flex items-center justify-between">
            <span className="text-gray-500 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              {t("voice_ai.date_slot", "Date & Créneau :")}
            </span>
            <span className="font-medium text-gray-800">
              {actionPreview.dateFormatted} ({actionPreview.timePreference || t("voice_ai.agreed_time", "Horaire convenu")})
            </span>
          </div>
        )}

        {actionPreview.priceIndicative && (
          <div className="flex items-center justify-between pt-1 border-t border-gray-200">
            <span className="text-gray-500">{t("voice_ai.indicative_price", "Tarif indicatif :")}</span>
            <span className="font-bold text-gray-900">{actionPreview.priceIndicative}</span>
          </div>
        )}

        {actionPreview.content && (
          <div className="pt-1">
            <span className="text-gray-500 block mb-0.5">{t("voice_ai.message_content", "Contenu du message :")}</span>
            <p className="bg-white p-2 rounded border border-gray-200 text-gray-800 italic">
              « {actionPreview.content} »
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isExecuting}
          className="text-xs text-gray-500 hover:text-gray-700 h-8"
        >
          <X className="h-3.5 w-3.5 mr-1" />
          {t("voice_ai.cancel", "Annuler")}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onModify}
            disabled={isExecuting}
            className="text-xs text-gray-700 border-gray-300 h-8"
          >
            <Edit className="h-3.5 w-3.5 mr-1" />
            {t("voice_ai.modify", "Modifier")}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={onConfirm}
            disabled={isExecuting}
            className="bg-teal-600 hover:bg-teal-700 text-white font-semibold text-xs h-8 shadow-sm shadow-teal-600/20"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                {t("common.executing", "Exécution...")}
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {t("voice_ai.confirm_action", "Confirmer l'action")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};
