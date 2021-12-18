import { query as q } from 'faunadb'
import { fauna } from '../../../services/fauna'
import { stripe } from '../../../services/stripe'

// Cria uma função assíncrona que recebe 2 parâmetros
export async function saveSubscription(
  subscriptionId: string,
  customerId: string,
  createAction = false,
) {

  // Busca o usuário no banco do FaunaDB com o ID {customerId}  
  const userRef = await fauna.query(
    q.Select(
      'ref',
      q.Get(
        q.Match(
          q.Index('user_by_stripe_customer_id'),
          customerId
        )
      )
    )
  )

  // Busca no Stripe a subscription que tiver o mesmo valor do {subscriptionId}
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Caso a ação anterior tenha sido executada com êxito, cria um objeto com os dados dele
  const subscriptionData = {
    id: subscription.id,
    userId: userRef,
    status: subscription.status,
    price_id: subscription.items.data[0].price.id,
  }

  // Salva ou atualiza os dados da subscription no FaunaDB
  if (createAction) {
    await fauna.query(
      q.Create(
        q.Collection('subscriptions'),
        { data: subscriptionData }
      )
    )
  } else {
    await fauna.query(
      q.Replace(
        q.Select(
          'ref',
          q.Get(
            q.Match(
              q.Index('subscription_by_id'),
              subscriptionId,
            )
          )
        ),
        { data: subscriptionData }
      ),
    )
  }
}
