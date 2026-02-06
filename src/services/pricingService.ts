
import { supabase } from '../supabaseClient';

export interface PriceCheckResult {
    itemId: string;
    inputPrice: number;
    masterPrice: number;
    isDifferent: boolean;
}

export const PricingService = {
    /**
     * Fetches the official "Master Price" for a list of items based on a specific customer type.
     * Use this to compare against the prices currently in the cart.
     */
    async getMasterPrices(itemIds: string[], customerType: 'UMUM' | 'KHUSUS'): Promise<Record<string, number>> {
        if (!itemIds.length) return {};

        const { data, error } = await supabase
            .from('items')
            .select('id, price_default, price_khusus')
            .in('id', itemIds);

        if (error) {
            console.error('Error fetching master prices:', error);
            throw error;
        }

        const priceMap: Record<string, number> = {};
        data?.forEach((item) => {
            // Determine which price column to use based on the standard type
            const price = customerType === 'KHUSUS' ? item.price_khusus : item.price_default;
            priceMap[item.id] = Number(price);
        });

        return priceMap;
    },

    /**
     * Checks if any items in the cart deviate from their master price.
     * Returns a list of items that have changed prices.
     */
    async checkPriceDeviations(
        cartItems: { id: string, price: number }[],
        currentCustomerType: 'UMUM' | 'KHUSUS' | 'CUSTOM'
    ): Promise<PriceCheckResult[]> {
        // If already custom, we don't enforce "Master Price" deviations because they are allowed to have custom prices.
        // However, the requirement is to detect if we need to PROMOTE to custom.
        // So we only really care if the current type is UMUM or KHUSUS.

        if (currentCustomerType === 'CUSTOM') return [];

        const itemIds = cartItems.map(i => i.id);
        const masterPrices = await this.getMasterPrices(itemIds, currentCustomerType);

        const deviations: PriceCheckResult[] = [];

        cartItems.forEach(item => {
            const masterPrice = masterPrices[item.id];
            // If master price is missing (shouldn't happen), assume no deviation or handle error.
            // Using loose inequality to catch significant differences (floating point safety not strictly needed for integers but good practice)
            if (masterPrice !== undefined && item.price !== masterPrice) {
                deviations.push({
                    itemId: item.id,
                    inputPrice: item.price,
                    masterPrice: masterPrice,
                    isDifferent: true
                });
            }
        });

        return deviations;
    },

    /**
     * Promotes a customer to CUSTOM type and saves the new custom prices.
     */
    async promoteToCustomAndSavePrices(
        customerId: string,
        deviations: PriceCheckResult[]
    ): Promise<void> {
        // 1. Update Customer Type
        const { error: customerError } = await supabase
            .from('customers')
            .update({ customer_type: 'CUSTOM' })
            .eq('id', customerId);

        if (customerError) throw customerError;

        // 2. Upsert Prices
        if (deviations.length === 0) return;

        const upsertData = deviations.map(d => ({
            customer_id: customerId,
            item_id: d.itemId,
            price: d.inputPrice
        }));

        const { error: priceError } = await supabase
            .from('customer_item_prices')
            .upsert(upsertData, { onConflict: 'customer_id,item_id' });

        if (priceError) throw priceError;
    }
};
